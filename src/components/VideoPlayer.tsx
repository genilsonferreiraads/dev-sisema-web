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
  console.log('YouTube API Key:', process.env.REACT_APP_YOUTUBE_API_KEY ? 'Presente' : 'Ausente');
  
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [player, setPlayer] = useState<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [lastWatchedVideos, setLastWatchedVideos] = useState<string[]>(() => {
    // Carrega o histórico do localStorage ao inicializar
    const saved = localStorage.getItem('lastWatchedVideos');
    return saved ? JSON.parse(saved) : [];
  });
  const [user] = useState(() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  });
  const [isInternalStateChange, setIsInternalStateChange] = useState(false);

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
            onError: () => {
              // Mantém o erro silencioso
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
        // Mantém o erro silencioso
      }
    } catch (error) {
      // Mantém o erro silencioso
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

  const getVideoTitle = async (url: string): Promise<string> => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtube.com')
          ? url.split('v=')[1]?.split('&')[0]
          : url.split('youtu.be/')[1]?.split('?')[0];

        // Verifica se a chave da API está presente
        const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
        if (!apiKey) {
          console.error('API key não encontrada:', process.env.REACT_APP_YOUTUBE_API_KEY);
          return 'Vídeo do YouTube';
        }

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet`
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Erro na requisição:', errorData);
          return 'Vídeo do YouTube';
        }

        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
          console.error('Nenhum item encontrado para o ID:', videoId);
          return 'Vídeo do YouTube';
        }

        const title = data.items[0]?.snippet?.title;
        if (!title) {
          console.error('Título não encontrado no snippet');
          return 'Vídeo do YouTube';
        }

        return title;
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
      return 'Vídeo do YouTube';
    }
  };

  const handleAddVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setIsLoading(true);
    
    if (!newVideoUrl.trim()) {
      setError('Por favor, insira uma URL válida');
      setIsLoading(false);
      return;
    }

    try {
      const embedUrl = getEmbedUrl(newVideoUrl);
      const videoTitle = await getVideoTitle(newVideoUrl);
      
      const newVideo = await videoService.addVideo(embedUrl, videoTitle);
      
      // Atualiza a lista de vídeos mantendo o novo vídeo no topo
      setVideos(prev => [newVideo, ...prev]);
      setNewVideoUrl('');
      setSelectedVideo(newVideo);

      // Atualiza o histórico se houver usuário
      if (user?.id) {
        await videoService.saveVideoHistory(user.id, newVideo.id);
        setLastWatchedVideos(prev => [newVideo.id, ...prev]);
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

  const handleVideoSelect = async (video: VideoData) => {
    setIsInternalStateChange(true);
    
    setSelectedVideo(video);
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
      await videoService.saveVideoHistory(user.id, video.id);
      
      setLastWatchedVideos(prev => {
        const newOrder = [video.id, ...prev.filter(id => id !== video.id)];
        return newOrder.slice(0, videos.length);
      });

      setVideos(prev => [
        video,
        ...prev.filter(v => v.id !== video.id)
      ]);
    }

    // Reset o flag após um curto delay
    setTimeout(() => {
      setIsInternalStateChange(false);
    }, 100);
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

    if (isPlaying) {
      player.playVideo();
    } else {
      const audioElement = document.querySelector('audio');
      const isAudioPlaying = audioElement && !audioElement.paused;
      
      if (!isAudioPlaying) {
        player.pauseVideo();
      }
    }
  }, [isPlaying, player, isPlayerReady]);

  return (
    <div className="bg-[#1e1e1e] text-gray-300 rounded-lg shadow-lg p-3">
      <form onSubmit={handleAddVideo} className="mb-3">
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
        lastWatchedVideos={lastWatchedVideos}
      />
    </div>
  );
};

export default VideoPlayer;