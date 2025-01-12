import React, { useState, useEffect, useRef } from 'react';
import { videoService, VideoData } from '../lib/supabase';
import VideoSidebar from './VideoSidebar';
import ClipboardAlert from './ClipboardAlert';
import './VideoPlayer.css';
import { getApiKeys, fetchWithCache } from '../config/api';

interface VideoPlayerProps {
  onEnded: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  pendingVideoId?: string;
}

interface YouTubeSearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      medium: {
        url: string;
      };
    };
  };
  contentDetails?: {
    duration: string; // Formato ISO 8601 (PT1H2M10S)
  };
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ onEnded, isPlaying, setIsPlaying, pendingVideoId }) => {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [player, setPlayer] = useState<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastWatchedVideos, setLastWatchedVideos] = useState<string[]>(() => {
    const saved = localStorage.getItem('lastWatchedVideos');
    return saved ? JSON.parse(saved) : [];
  });
  const [user] = useState(() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  });
  const [isInternalStateChange, setIsInternalStateChange] = useState(false);
  const [lastSearchTerm, setLastSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<YouTubeSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  useEffect(() => {
    loadVideos();
  }, []);

  const loadYouTubeAPI = () => {
    return new Promise<void>((resolve) => {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (existingScript) {
        if ((window as any).YT && (window as any).YT.Player) {
          resolve();
          return;
        }
      }

      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        resolve();
      };
    });
  };

  const initializePlayer = async () => {
    try {
      await loadYouTubeAPI();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!(window as any).YT?.Player) return;

      const iframe = document.querySelector('#youtube-player');
      if (!iframe || player) return;
      
      try {
        const newPlayer = new (window as any).YT.Player('youtube-player', {
          events: {
            onReady: (event: any) => {
              setPlayer(event.target);
              setIsPlayerReady(true);
              
              // Verifica se há áudio tocando ao inicializar
              const audioElement = document.querySelector('audio');
              const isAudioPlaying = audioElement && !audioElement.paused;
              event.target.setVolume(isAudioPlaying ? 10 : 100);
            },
            onStateChange: handleStateChange,
            onError: (error: any) => {
              console.error('Erro no player:', error);
            }
          },
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
            widget_referrer: window.location.origin,
            playsinline: 1,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            autoplay: 0
          }
        });
      } catch (error) {
        console.error('Erro ao inicializar player:', error);
      }
    } catch (error) {
      console.error('Erro ao carregar API:', error);
    }
  };

  useEffect(() => {
    initializePlayer();

    return () => {
      if (player) {
        player.destroy();
      }
      delete (window as any).onYouTubeIframeAPIReady;
    };
  }, []);

  const loadVideos = async () => {
    try {
      const data = await videoService.getRecentVideos();
      
      // Garante que temos um usuário antes de carregar o histórico
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;
      
      if (user?.id) {
        // Carrega o último vídeo assistido
        const lastVideoId = await videoService.getLastWatchedVideo(user.id);
        
        if (lastVideoId) {
          const lastVideo = data.find(v => v.id === lastVideoId);
          if (lastVideo) {
            setSelectedVideo(lastVideo);
            setVideos([lastVideo, ...data.filter(v => v.id !== lastVideoId)]);
          } else {
            setVideos(data);
          }
        } else {
          setVideos(data);
        }

        // Carrega o histórico completo
        const history = await videoService.getVideoHistory(user.id);
        setLastWatchedVideos(history);
      } else {
        setVideos(data);
      }
    } catch (error) {
      console.error('Erro ao carregar vídeos:', error);
      setVideos([]);
    }
  };

  const getEmbedUrl = (url: string) => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtube.com') 
          ? url.split('v=')[1]?.split('&')[0]
          : url.split('youtu.be/')[1]?.split('?')[0];
        
        return `https://www.youtube.com/embed/${videoId}`;
      }
      if (url.includes('vimeo.com')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
        return `https://player.vimeo.com/video/${videoId}`;
      }
      return url;
    } catch (error) {
      return url;
    }
  };

  const getVideoTitle = async (url: string): Promise<string> => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtube.com')
          ? url.split('v=')[1]?.split('&')[0]
          : url.split('youtu.be/')[1]?.split('?')[0];

        setThumbnailUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);

        const apiKeys = getApiKeys();

        try {
          const data = await fetchWithCache(
            `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=API_KEY&part=snippet`,
            apiKeys
          );
          if (!data.items?.[0]?.snippet?.title) return 'Vídeo do YouTube';
          return data.items[0].snippet.title;
        } catch (error) {
          console.error('Erro ao buscar título com todas as APIs:', error);
          return 'Vídeo do YouTube';
        }
      }
      return 'Vídeo do YouTube';
    } catch (error) {
      return 'Vídeo do YouTube';
    }
  };

  const handleAddVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const urlToAdd = newVideoUrl.trim();
    if (!urlToAdd) {
      setError('Por favor, insira uma URL válida');
      setIsLoading(false);
      return;
    }

    // Dispara o evento imediatamente após clicar no botão
    window.dispatchEvent(new CustomEvent('videoAdded', {
      detail: { videoUrl: urlToAdd }
    }));

    try {
      const embedUrl = getEmbedUrl(urlToAdd);
      
      // Verifica se o vídeo já existe
      const videoId = urlToAdd.includes('youtube.com')
        ? urlToAdd.split('v=')[1]?.split('&')[0]
        : urlToAdd.includes('youtu.be')
        ? urlToAdd.split('youtu.be/')[1]?.split('?')[0]
        : null;

      const existingVideo = videos.find(v => v.url.includes(videoId || ''));
      
      if (existingVideo) {
        // Se o vídeo já existe, apenas atualiza a ordem e seleciona
        await videoService.updateVideoOrder(existingVideo.id);
        setVideos(prev => [existingVideo, ...prev.filter(v => v.id !== existingVideo.id)]);
        setSelectedVideo(existingVideo);
        setNewVideoUrl('');

        // Atualiza o histórico se houver usuário
        if (user?.id) {
          videoService.saveVideoHistory(user.id, existingVideo.id).catch(console.error);
          setLastWatchedVideos(prev => [existingVideo.id, ...prev]);
        }

        // Dispara evento para fechar o popup
        if (videoId) {
          window.dispatchEvent(new CustomEvent('videoAdded', {
            detail: { videoUrl: urlToAdd }
          }));
        }
      } else {
        // Se não existe, adiciona normalmente
        const videoTitle = await getVideoTitle(urlToAdd);
        const newVideo = await videoService.addVideo(embedUrl, videoTitle);
        
        setVideos(prev => [newVideo, ...prev.filter(v => v.id !== newVideo.id)]);
        setSelectedVideo(newVideo);
        setNewVideoUrl('');

        if (user?.id) {
          videoService.saveVideoHistory(user.id, newVideo.id).catch(console.error);
          setLastWatchedVideos(prev => [newVideo.id, ...prev]);
        }

        if (videoId) {
          window.dispatchEvent(new CustomEvent('videoAdded', {
            detail: { videoUrl: urlToAdd }
          }));
        }
      }
    } catch (error: any) {
      console.error('Erro detalhado:', error);
      setError(
        error.message || 
        error.error_description || 
        'Erro ao adicionar vídeo. Verifique se a URL é válida.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (videoId: string) => {
    try {
      await videoService.deleteVideo(videoId);
      setVideos(prev => prev.filter(video => video.id !== videoId));
    } catch (error) {
      console.error('Erro ao deletar vídeo:', error);
    }
  };

  const formatDuration = (duration: string) => {
    try {
      const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
      
      if (!match) return '00:00';

      const hours = (match[1] || '').replace('H', '');
      const minutes = (match[2] || '').replace('M', '');
      const seconds = (match[3] || '').replace('S', '');

      const parts = [];
      
      if (hours) parts.push(hours.padStart(2, '0'));
      parts.push((minutes || '0').padStart(2, '0'));
      parts.push((seconds || '0').padStart(2, '0'));

      return parts.join(':');
    } catch (error) {
      console.error('Erro ao formatar duração:', error);
      return '00:00';
    }
  };

  const handleSearch = async (input: string) => {
    setIsSearching(true);
    setError('');

    const apiKeys = getApiKeys();
    console.log('APIs disponíveis para busca:', apiKeys.length);

    try {
      // Primeira requisição para buscar os vídeos
      console.log('Iniciando busca de vídeos...');
      const searchData = await fetchWithCache(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(input)}&type=video&key=API_KEY&maxResults=21`,
        apiKeys
      );

      if (!searchData?.items?.length) {
        console.log('Nenhum resultado encontrado');
        setError('Nenhum vídeo encontrado para esta busca.');
        return;
      }

      console.log(`Encontrados ${searchData.items.length} vídeos`);

      try {
        // Segunda requisição para buscar os detalhes dos vídeos
        console.log('Buscando detalhes dos vídeos...');
        const videoIds = searchData.items.map((item: YouTubeSearchResult) => item.id.videoId).join(',');
        const detailsData = await fetchWithCache(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=API_KEY`,
          apiKeys
        );

        // Combina os resultados
        console.log('Combinando resultados...');
        const resultsWithDuration = searchData.items.map((item: YouTubeSearchResult) => {
          const details = detailsData.items.find((detail: any) => detail.id === item.id.videoId);
          return {
            ...item,
            contentDetails: details?.contentDetails
          };
        });

        console.log('Busca concluída com sucesso');
        setSearchResults(resultsWithDuration);
      } catch (detailsError) {
        console.error('Erro ao buscar detalhes:', detailsError);
        // Se falhar ao buscar detalhes, ainda mostra os resultados básicos
        setSearchResults(searchData.items);
      }
    } catch (error) {
      console.error('Erro detalhado na busca:', error);
      setError('Erro ao buscar vídeos. Por favor, tente novamente.');
      setSearchResults([]);
    } finally {
      if (searchResults.length === 0) {
        setIsSearching(false);
      }
    }
  };

  const isYouTubeUrl = (url: string): boolean => {
    return url.includes('youtube.com/watch?v=') || url.includes('youtu.be/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = newVideoUrl.trim();
    setLastSearchTerm(input);

    if (!input) {
      setError('Por favor, insira uma URL ou termo de busca');
      return;
    }

    setIsLoading(true);

    try {
      // Verifica se é uma URL do YouTube
      if (isYouTubeUrl(input)) {
        // Usa a função handleAddVideo existente que já tem toda a lógica necessária
        await handleAddVideo();
        setShowSuggestions(false); // Fecha as sugestões
      } else {
        // Se não for URL, faz a busca e abre o modal
        await handleSearch(input);
        setIsSearching(true);
      }
    } catch (error) {
      console.error('Erro:', error);
      setError(isYouTubeUrl(input) 
        ? 'Erro ao adicionar vídeo. Verifique se a URL é válida.'
        : 'Erro ao buscar vídeos. Por favor, tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchButton = () => {
    const input = newVideoUrl.trim();

    if (!input) {
      setError('Por favor, insira uma URL ou termo de busca');
      return;
    }

    // Se for uma URL do YouTube, adiciona o vídeo
    if (isYouTubeUrl(input)) {
      handleAddVideo();
      return;
    }

    // Se não for URL e já tem resultados para o mesmo termo, alterna o modal
    if (searchResults.length > 0 && input === lastSearchTerm) {
      setIsSearching(!isSearching);
    } else {
      // Se não for URL e não tem resultados ou é um novo termo, faz a busca
      handleSearch(input);
    }
  };

  const isYouTubeSearchResult = (video: VideoData | YouTubeSearchResult): video is YouTubeSearchResult => {
    return 'id' in video && typeof video.id === 'object' && 'videoId' in video.id;
  };

  const handleVideoSelect = async (video: VideoData | YouTubeSearchResult) => {
    if (isLoading) return; // Previne múltiplos cliques enquanto processa
    setIsLoading(true);
    setIsSearching(false); // Fecha o modal imediatamente
    
    try {
      let selectedVideoData: VideoData;
      
      if (isYouTubeSearchResult(video)) {
        // É um resultado da busca do YouTube
        const videoUrl = `https://www.youtube.com/embed/${video.id.videoId}`;
        const newVideo = await videoService.addVideo(videoUrl, video.snippet.title);
        selectedVideoData = newVideo;
      } else {
        // É um vídeo existente
        selectedVideoData = video;
      }
      
      setSelectedVideo(selectedVideoData);
      setIsSidebarOpen(false);
      
      // Verifica se há áudio tocando
      const audioElement = document.querySelector('audio');
      const isAudioPlaying = audioElement && !audioElement.paused;

      // Se houver áudio tocando, já inicia com volume baixo
      if (isAudioPlaying && player && isPlayerReady) {
        player.setVolume(10);
      } else if (player && isPlayerReady) {
        player.setVolume(100);
      }

      // Inicia o vídeo sem disparar eventos externos
      if (player && isPlayerReady) {
        try {
          await player.playVideo();
        } catch (error) {
          console.error('Erro ao iniciar vídeo:', error);
        }
      }
      
      if (user?.id) {
        await videoService.saveVideoHistory(user.id, selectedVideoData.id);
        
        setLastWatchedVideos(prev => {
          const newOrder = [selectedVideoData.id, ...prev.filter(id => id !== selectedVideoData.id)];
          return newOrder.slice(0, videos.length);
        });

        setVideos(prev => [
          selectedVideoData,
          ...prev.filter(v => v.id !== selectedVideoData.id)
        ]);
      }
    } catch (error) {
      console.error('Erro ao selecionar vídeo:', error);
      setError('Erro ao adicionar vídeo. Por favor, tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStateChange = (event: any) => {
    if (isInternalStateChange) return;

    if (event.data === 0) { // vídeo terminou
      if (pendingVideoId) {
        const pendingVideo = videos.find(v => v.id === pendingVideoId);
        if (pendingVideo) {
          setSelectedVideo(pendingVideo);
        }
      }
      onEnded();
    } else if (event.data === 1) { // vídeo começou a tocar
      // Apenas ajusta o volume se necessário
      const audioElement = document.querySelector('audio');
      const isAudioPlaying = audioElement && !audioElement.paused;
      
      if (isAudioPlaying && player) {
        player.setVolume(10);
      }
    }
  };

  const fadeIframeVolume = (start: number, end: number, duration: number) => {
    if (!player || !isPlayerReady) return;

    const steps = 20;
    const stepValue = (end - start) / steps;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;
      const newVolume = start + (stepValue * currentStep);
      const volume = Math.min(Math.max(newVolume, 0), 1) * 100;
      player.setVolume(volume);

      if (currentStep >= steps) {
        clearInterval(fadeInterval);
      }
    }, stepDuration);
  };

  useEffect(() => {
    const handleAudioPlay = () => {
      if (isPlayerReady) {
        fadeIframeVolume(1, 0.10, 500);
      }
    };

    const handleAudioStop = () => {
      if (isPlayerReady) {
        fadeIframeVolume(0.10, 1, 500);
      }
    };

    window.addEventListener('audioPlay', handleAudioPlay);
    window.addEventListener('audioStop', handleAudioStop);

    return () => {
      window.removeEventListener('audioPlay', handleAudioPlay);
      window.removeEventListener('audioStop', handleAudioStop);
    };
  }, [isPlayerReady]);

  useEffect(() => {
    if (selectedVideo || videos[0]) {
      setPlayer(null);
      setIsPlayerReady(false);
      initializePlayer();
    }
  }, [selectedVideo?.url, videos[0]?.url]);

  useEffect(() => {
    if (!player || !isPlayerReady) return;

    const handlePlayerState = () => {
      try {
        if (isPlaying) {
          player.playVideo();
        } else {
          const audioElement = document.querySelector('audio');
          const isAudioPlaying = audioElement && !audioElement.paused;
          
          if (!isAudioPlaying) {
            player.pauseVideo();
          }
        }
      } catch (error) {
        console.error('Erro ao controlar player:', error);
      }
    };

    // Adiciona um pequeno delay para garantir que o player está pronto
    const timeoutId = setTimeout(handlePlayerState, 500);

    return () => clearTimeout(timeoutId);
  }, [isPlaying, player, isPlayerReady]);

  const handlePopupVideo = async (url: string) => {
    console.log('=== Início do handlePopupVideo ===');
    console.log('URL recebida:', url);
    
    if (!url.trim()) {
      console.log('URL vazia, retornando');
      return null;
    }
    
    try {
      console.log('Extraindo ID do vídeo...');
      const videoId = url.includes('youtube.com') 
        ? url.split('v=')[1]?.split('&')[0]
        : url.includes('youtu.be')
        ? url.split('youtu.be/')[1]?.split('?')[0]
        : null;

      console.log('ID do vídeo extraído:', videoId);

      if (!videoId) {
        console.log('ID do vídeo inválido');
        throw new Error('URL inválida');
      }

      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      console.log('URL de embed gerada:', embedUrl);

      // Verifica se o vídeo já existe
      console.log('Verificando se o vídeo já existe...');
      const existingVideo = videos.find(v => v.url.includes(videoId));
      
      if (existingVideo) {
        // Se o vídeo já existe, apenas atualiza a ordem e seleciona
        console.log('Vídeo já existe, atualizando ordem...');
        await videoService.updateVideoOrder(existingVideo.id);
        setVideos(prev => [existingVideo, ...prev.filter(v => v.id !== existingVideo.id)]);
        setSelectedVideo(existingVideo);

        // Atualiza o histórico em background
        if (user?.id) {
          videoService.saveVideoHistory(user.id, existingVideo.id).catch(console.error);
          setLastWatchedVideos(prev => [existingVideo.id, ...prev]);
        }

        console.log('=== Fim do handlePopupVideo com sucesso (vídeo existente) ===');
        return existingVideo;
      }

      // Se não existe, adiciona normalmente
      console.log('Vídeo não existe, adicionando novo...');
      const videoTitle = await getVideoTitle(url);
      const newVideo = await videoService.addVideo(embedUrl, videoTitle);
      
      // Atualiza a interface
      console.log('Atualizando interface...');
      setVideos(prev => [newVideo, ...prev.filter(v => v.id !== newVideo.id)]);
      setSelectedVideo(newVideo);

      // Atualiza o histórico em background
      if (user?.id) {
        videoService.saveVideoHistory(user.id, newVideo.id).catch(console.error);
        setLastWatchedVideos(prev => [newVideo.id, ...prev]);
      }

      console.log('=== Fim do handlePopupVideo com sucesso (novo vídeo) ===');
      return newVideo;
    } catch (error: any) {
      console.error('=== Erro no handlePopupVideo ===', error);
      setError('Erro ao adicionar vídeo. Verifique se a URL é válida.');
      throw error;
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewVideoUrl(value);
    
    // Se o input estiver vazio, limpa tudo
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setError('');
      return;
    }

    // Se for URL do YouTube, não mostra sugestões
    if (isYouTubeUrl(value)) {
      setSuggestions([]);
      setShowSuggestions(false);
      setError('');
      return;
    }

    // Limpa o timeout anterior
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Reduzimos o delay de 500ms para 300ms
    const newTimeout = setTimeout(async () => {
      const apiKeys = getApiKeys();

      try {
        const data = await fetchWithCache(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(value)}&type=video&key=API_KEY&maxResults=5`,
          apiKeys
        );
        setSuggestions(data.items);
        setShowSuggestions(true);
        setError('');
      } catch (error) {
        console.error('Erro ao buscar sugestões:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300); // Reduzido de 500ms para 300ms

    setTypingTimeout(newTimeout);
  };

  // Adiciona um ref para o container do input e sugestões
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha as sugestões quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSuggestionClick = (suggestion: YouTubeSearchResult) => {
    const searchText = suggestion.snippet.title;
    setNewVideoUrl(searchText);
    setShowSuggestions(false);
    setLastSearchTerm(searchText);
    handleSearch(searchText);
    setIsSearching(true);
  };

  // Adicione a função para limpar o input
  const handleClearInput = () => {
    setNewVideoUrl('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Adicione esta função para determinar o texto do botão
  const getButtonText = () => {
    const input = newVideoUrl.trim();
    
    if (!input) return "Buscar Vídeo";
    if (isYouTubeUrl(input)) return "Adicionar Vídeo";
    if (searchResults.length > 0) return "Ver Vídeos";
    return "Buscar Vídeo";
  };

  // Primeiro, adicione uma função para determinar qual ícone mostrar
  const getButtonIcon = () => {
    const input = newVideoUrl.trim();
    
    if (!input) return "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"; // Ícone de pesquisa
    if (isYouTubeUrl(input)) return "M12 4v16m8-8H4"; // Ícone de adicionar
    if (searchResults.length > 0) return "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"; // Ícone de olho
    return "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"; // Ícone de pesquisa (default)
  };

  return (
    <div className="bg-[#1e1e1e] text-gray-300 rounded-lg shadow-lg p-3">
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="flex flex-col gap-2" ref={containerRef}>
          <div className="relative">
            <input
              type="text"
              value={newVideoUrl}
              onChange={handleInputChange}
              placeholder="Cole uma URL do YouTube ou digite para buscar vídeos"
              className="w-full bg-[#2d2d2d] border border-[#404040] text-gray-200 rounded px-3 py-2 focus:border-[#e1aa1e] focus:outline-none pr-20"
              disabled={isLoading}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {newVideoUrl && (
                <button
                  type="button"
                  onClick={handleSearchButton}
                  className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#404040] transition-all duration-300"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              )}
              {newVideoUrl && (
                <button
                  type="button"
                  onClick={handleClearInput}
                  className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#404040] transition-all duration-300"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-[#2d2d2d] border border-[#404040] rounded-lg shadow-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                <div
                  className="p-3 hover:bg-[#363636] cursor-pointer transition-colors duration-300 flex items-center gap-3 border-b border-[#404040]"
                  onClick={() => handleSuggestionClick({ 
                    id: { videoId: 'search' },
                    snippet: {
                      title: newVideoUrl,
                      description: '',
                      thumbnails: { medium: { url: '' } }
                    }
                  })}
                >
                  <div className="text-gray-400 flex-shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-sm font-medium text-[#e1aa1e] flex-1">
                    Buscar "{newVideoUrl}"
                  </h4>
                </div>

                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id.videoId}
                    className="p-3 hover:bg-[#363636] cursor-pointer transition-colors duration-300 flex items-center gap-3"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="text-gray-400 flex-shrink-0">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-sm font-medium text-gray-200 flex-1">
                      {suggestion.snippet.title}
                    </h4>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </form>

      {isSearching && searchResults.length > 0 && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-70 z-40" onClick={() => setIsSearching(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-[#1e1e1e] rounded-xl shadow-2xl z-50 flex flex-col">
            <div className="flex flex-col items-center justify-between p-4 border-b border-[#404040]">
              <h2 className="text-lg font-semibold text-white mb-2">Resultados da Busca</h2>
              <p className="text-base text-[#e1aa1e] font-medium">
                {lastSearchTerm}
              </p>
              <button
                onClick={() => {
                  setIsSearching(false);
                  // Não limpa o input nem os resultados ao fechar o modal
                }}
                className="absolute right-4 top-4 p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors duration-300"
              >
                <svg
                  className="w-6 h-6 text-gray-400 hover:text-[#e1aa1e]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              <div className="grid grid-cols-3 gap-4">
                {searchResults.map((result) => (
                  <div
                    key={result.id.videoId}
                    className="group bg-[#2d2d2d] hover:bg-[#363636] rounded-xl overflow-hidden shadow-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl border border-transparent hover:border-[#e1aa1e] flex flex-col cursor-pointer"
                    onClick={() => handleVideoSelect(result)}
                  >
                    <div className="relative w-full pt-[56.25%]">
                      <img
                        src={result.snippet.thumbnails.medium.url}
                        alt={result.snippet.title}
                        className="absolute top-0 left-0 w-full h-full object-cover"
                      />
                      {result.contentDetails?.duration && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded">
                          {formatDuration(result.contentDetails.duration)}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                        <div className="transform scale-0 group-hover:scale-100 transition-transform duration-300">
                          <svg
                            className="w-12 h-12 text-white opacity-90"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <h3 className="text-sm font-semibold text-white group-hover:text-[#e1aa1e] transition-colors duration-300 line-clamp-2 mb-2">
                        {result.snippet.title}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-2 group-hover:text-gray-300 transition-colors duration-300 flex-1">
                        {result.snippet.description}
                      </p>
                      <div className="mt-2">
                        <button className="w-full flex items-center justify-center gap-1 bg-[#1e1e1e] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-300 hover:bg-[#e1aa1e] hover:text-gray-900 group-hover:bg-[#e1aa1e] group-hover:text-gray-900">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          <span>Adicionar ao Player</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={handleSearchButton}
          className={`add-video-button flex-1 ${
            isLoading 
              ? 'opacity-75 cursor-not-allowed' 
              : 'bg-[#e1aa1e] hover:bg-[#e1aa1e]/80'
          } bg-[#e1aa1e] text-gray-900 px-3 py-1.5 rounded transition-all duration-300 flex items-center justify-center gap-2`}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg 
                className="animate-spin h-4 w-4" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="animate-pulse">Adicionando...</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={getButtonIcon()}
                />
              </svg>
              <span>{getButtonText()}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="flex-1 bg-[#2d2d2d] hover:bg-[#404040] border border-[#404040] text-[#e1aa1e] px-3 py-1.5 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          Últimos Vídeos
        </button>
      </div>

      <div>
        {(selectedVideo || videos[0]) ? (
          <div className="rounded-lg overflow-hidden border border-[#404040]">
            <div className="relative pt-[56.25%]">
              <iframe
                id="youtube-player"
                src={`${selectedVideo?.url || videos[0]?.url}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&playsinline=1&widget_referrer=${encodeURIComponent(window.location.origin)}&controls=1&rel=0&modestbranding=1`}
                className="absolute top-0 left-0 w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title={`Video ${selectedVideo?.id || videos[0]?.id}`}
              />
            </div>
          </div>
        ) : (
          <div className="text-center p-6 text-gray-400 bg-[#2d2d2d] rounded-lg border border-[#404040]">
            Nenhum vídeo disponível. Adicione um vídeo para começar.
          </div>
        )}
      </div>

      <VideoSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        videos={videos}
        onVideoSelect={handleVideoSelect}
        lastWatchedVideos={lastWatchedVideos}
      />

      <ClipboardAlert 
        onAddVideo={handlePopupVideo}
        setError={setError}
        isLoading={isLoading}
      />
    </div>
  );
};

export default VideoPlayer;