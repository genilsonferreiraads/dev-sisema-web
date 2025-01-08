import React, { useState, useEffect } from 'react';
import { videoService, VideoData } from '../lib/supabase';
import VideoSidebar from './VideoSidebar';

interface VideoPlayerProps {
  onEnded: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  pendingVideoId?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ onEnded, isPlaying, setIsPlaying, pendingVideoId }) => {
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [player, setPlayer] = useState<YT.Player | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Carregar vídeos ao montar o componente
  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const data = await videoService.getVideos();
      setVideos(data);
      if (data.length > 0 && !selectedVideo) {
        setSelectedVideo(data[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar vídeos:', error);
    }
  };

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
        console.log('API do YouTube pronta');
        resolve();
      };
    });
  };

  const initializePlayer = async () => {
    try {
      await loadYouTubeAPI();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!(window as any).YT?.Player) {
        console.warn('API do YouTube ainda não está pronta após carregamento');
        return;
      }

      const iframe = document.querySelector('#youtube-player');
      if (!iframe || player) return;

      console.log('Inicializando player do YouTube...');
      
      try {
        const newPlayer = new (window as any).YT.Player('youtube-player', {
          events: {
            onReady: (event: any) => {
              console.log('Player do YouTube pronto e inicializado');
              setPlayer(event.target);
              setIsPlayerReady(true);
              event.target.setVolume(100);
            },
            onStateChange: handleStateChange,
            onError: (event: any) => {
              console.error('Erro no player do YouTube:', event.data);
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
      console.error('Erro ao inicializar player:', error);
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

  // Função para converter URL do YouTube em formato embed
  const getEmbedUrl = (url: string) => {
    console.log('URL original:', url);
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtube.com') 
          ? url.split('v=')[1]?.split('&')[0]
          : url.split('youtu.be/')[1]?.split('?')[0];
        
        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        console.log('URL convertida:', embedUrl);
        return embedUrl;
      }
      if (url.includes('vimeo.com')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
        const embedUrl = `https://player.vimeo.com/video/${videoId}`;
        console.log('URL convertida:', embedUrl);
        return embedUrl;
      }
      return url;
    } catch (error) {
      console.error('Erro ao processar URL:', error);
      return url;
    }
  };

  // Função para extrair título do vídeo do YouTube
  const getVideoTitle = async (url: string): Promise<string> => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtube.com')
          ? url.split('v=')[1]?.split('&')[0]
          : url.split('youtu.be/')[1]?.split('?')[0];
        
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=AIzaSyAyTc_jYQSVM_3kg95t8ai3CWckZGG0v4c&part=snippet`
        );
        const data = await response.json();
        
        if (data.error) {
          console.error('Erro da API do YouTube:', data.error);
          return 'Vídeo do YouTube';
        }

        return data.items[0]?.snippet?.title || 'Vídeo do YouTube';
      }
      
      if (url.includes('vimeo.com')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
        const response = await fetch(`https://vimeo.com/api/v2/video/${videoId}.json`);
        const data = await response.json();
        return data[0]?.title || 'Vídeo do Vimeo';
      }
      
      return 'Vídeo';
    } catch (error) {
      console.error('Erro ao obter título do vídeo:', error);
      return 'Vídeo';
    }
  };

  const handleAddVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newVideoUrl.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const video = await videoService.addVideo(newVideoUrl);
      setVideos(prev => [video, ...prev]);
      setNewVideoUrl('');
      setSelectedVideo(video);
    } catch (error) {
      setError('Erro ao adicionar vídeo. Verifique a URL e tente novamente.');
      console.error('Erro ao adicionar vídeo:', error);
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

  const handleVideoSelect = (video: VideoData) => {
    setSelectedVideo(video);
    setIsSidebarOpen(false);
  };

  const handlePlayerReady = (event: any) => {
    console.log('Player pronto');
    if (isPlaying) {
      console.log('Iniciando reprodução automática');
      event.target.playVideo();
    }
  };

  const handleStateChange = (event: any) => {
    console.log('Estado do vídeo mudou:', event.data);
    
    if (event.data === 0) { // vídeo terminou
      console.log('Vídeo terminou');
      setIsPlaying(false);
      // Dispara evento de fim
      window.dispatchEvent(new Event('externalMediaStop'));
      
      // Se houver um vídeo pendente, seleciona ele
      if (pendingVideoId) {
        const pendingVideo = videos.find(v => v.id === pendingVideoId);
        if (pendingVideo) {
          console.log('Reproduzindo vídeo pendente:', pendingVideo.id);
          setSelectedVideo(pendingVideo);
          setIsPlaying(true);
        }
      }
      
      onEnded();
    } else if (event.data === 1) { // vídeo começou a tocar
      console.log('Vídeo começou a tocar');
      setIsPlaying(true);
      // Dispara evento de início
      window.dispatchEvent(new Event('externalMediaPlay'));
    } else if (event.data === 2) { // vídeo foi pausado
      console.log('Vídeo pausado');
      setIsPlaying(false);
      // Dispara evento de fim
      window.dispatchEvent(new Event('externalMediaStop'));
    }
  };

  // Função para extrair videoId do YouTube
  const extractVideoId = (url: string = '') => {
    try {
      if (!url) return '';
      
      let videoId = '';
      
      if (url.includes('youtube.com/embed/')) {
        videoId = url.split('embed/')[1]?.split('?')[0];
      } else if (url.includes('youtube.com/watch')) {
        videoId = url.split('v=')[1]?.split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      }

      console.log('Extraído videoId:', videoId, 'da URL:', url);
      return videoId;
    } catch (error) {
      console.error('Erro ao extrair videoId:', error);
      return '';
    }
  };

  // Adicione esta função para controlar o fade do volume do iframe
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

  // Adicione este useEffect para escutar eventos de áudio
  useEffect(() => {
    const handleAudioPlay = () => {
      console.log('Áudio começou a tocar, tentando diminuir volume do vídeo');
      if (isPlayerReady) {
        fadeIframeVolume(1, 0.10, 500);
      } else {
        console.log('Player não está pronto para ajustar volume');
      }
    };

    const handleAudioStop = () => {
      console.log('Áudio parou, tentando restaurar volume do vídeo');
      if (isPlayerReady) {
        fadeIframeVolume(0.10, 1, 500);
      } else {
        console.log('Player não está pronto para ajustar volume');
      }
    };

    window.addEventListener('audioPlay', handleAudioPlay);
    window.addEventListener('audioStop', handleAudioStop);

    return () => {
      window.removeEventListener('audioPlay', handleAudioPlay);
      window.removeEventListener('audioStop', handleAudioStop);
    };
  }, [isPlayerReady]);

  // Adicione um useEffect para reinicializar o player quando o vídeo mudar
  useEffect(() => {
    if (selectedVideo || videos[0]) {
      console.log('Vídeo mudou, reinicializando player...');
      setPlayer(null);
      setIsPlayerReady(false);
      initializePlayer();
    }
  }, [selectedVideo?.url, videos[0]?.url]);

  return (
    <div className="bg-[#1e1e1e] text-gray-300 rounded-lg shadow-lg p-4">
      <form onSubmit={handleAddVideo} className="mb-4">
        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder="Cole a URL do YouTube ou Vimeo aqui"
            className="w-full bg-[#2d2d2d] border border-[#404040] text-gray-200 rounded px-3 py-2 focus:border-[#e1aa1e] focus:outline-none"
            disabled={isLoading}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </form>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => handleAddVideo()}
          className={`flex-1 ${
            isLoading 
              ? 'bg-[#e1aa1e]/50 cursor-not-allowed' 
              : 'bg-[#e1aa1e] hover:bg-[#e1aa1e]/80'
          } text-gray-900 px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-2`}
          disabled={isLoading}
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          {isLoading ? 'Adicionando...' : 'Buscar Vídeo'}
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
      />
    </div>
  );
};

export default VideoPlayer; 