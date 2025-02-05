import React, { useEffect, useState, useRef } from 'react';
import { getApiKeys, fetchWithCache } from '../config/api';

interface ClipboardAlertProps {
  onAddVideo: (url: string) => Promise<any>;
  setError?: (error: string) => void;
  isLoading?: boolean;
}

const STORAGE_KEY = 'processedVideos';
const EXPIRATION_TIME = 60 * 60 * 1000; // 1 hora em milissegundos

interface StoredVideo {
  url: string;
  timestamp: number;
}

const saveToStorage = (url: string) => {
  try {
    const currentTime = new Date().getTime();
    const stored = localStorage.getItem(STORAGE_KEY);
    const processedVideos: StoredVideo[] = stored ? JSON.parse(stored) : [];
    
    // Remove vídeos expirados
    const validVideos = processedVideos.filter(
      video => currentTime - video.timestamp < EXPIRATION_TIME
    );
    
    // Adiciona o novo vídeo
    validVideos.push({ url, timestamp: currentTime });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validVideos));
  } catch (error) {
    // Erros de localStorage são esperados em alguns casos
  }
};

const isVideoProcessed = (url: string): boolean => {
  try {
    const currentTime = new Date().getTime();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const processedVideos: StoredVideo[] = JSON.parse(stored);
    
    // Filtra vídeos expirados e atualiza o storage
    const validVideos = processedVideos.filter(
      video => currentTime - video.timestamp < EXPIRATION_TIME
    );
    
    if (validVideos.length !== processedVideos.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validVideos));
    }
    
    return validVideos.some(video => video.url === url);
  } catch (error) {
    // Erros de localStorage são esperados em alguns casos
    return false;
  }
};

const ClipboardAlert: React.FC<ClipboardAlertProps> = ({ 
  onAddVideo, 
  setError
}) => {
  const [showAlert, setShowAlert] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const processedUrls = useRef(new Set<string>());

  const getVideoTitle = async (url: string): Promise<string> => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtube.com')
          ? url.split('v=')[1]?.split('&')[0]
          : url.split('youtu.be/')[1]?.split('?')[0];

        // Define a thumbnail URL
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
      console.error('Erro ao processar URL:', error);
      return 'Vídeo do YouTube';
    }
  };

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!clipboardUrl || isAdding) return;

    setIsAdding(true);
    
    try {
      await onAddVideo(clipboardUrl);
      processedUrls.current.add(clipboardUrl);
      saveToStorage(clipboardUrl); // Salva no localStorage
      setShowAlert(false);
      setIsExiting(false);
      setVideoTitle('');
      setThumbnailUrl('');
      setClipboardUrl('');
    } catch (error: any) {
      setError?.(error.message || 'Erro ao adicionar vídeo');
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    if (clipboardUrl) {
      processedUrls.current.add(clipboardUrl);
      saveToStorage(clipboardUrl); // Salva no localStorage
    }
    
    setIsExiting(true);
    
    setTimeout(() => {
      setShowAlert(false);
      setIsExiting(false);
      setVideoTitle('');
      setThumbnailUrl('');
      setClipboardUrl('');
    }, 300);
  };

  const isYouTubeUrl = (url: string) => {
    return url.includes('youtube.com/watch?v=') || url.includes('youtu.be/');
  };

  useEffect(() => {
    const handleCopy = async () => {
      if (!document.hasFocus()) return;

      try {
        const text = await navigator.clipboard.readText();
        if (text?.includes('youtube.com/watch?v=') || text?.includes('youtu.be/')) {
          // Verifica tanto no Set quanto no localStorage
          if (!processedUrls.current.has(text) && !isVideoProcessed(text)) {
            const videoId = text.includes('youtube.com')
              ? text.split('v=')[1]?.split('&')[0]
              : text.split('youtu.be/')[1]?.split('?')[0];
            
            setThumbnailUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
            setClipboardUrl(text);
            setShowAlert(true);
            getVideoTitle(text).then(setVideoTitle);
          }
        }
      } catch (error) {
        if (error instanceof Error && !error.message.includes('Document is not focused')) {
          console.error('Erro ao acessar clipboard:', error);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v')) {
        queueMicrotask(handleCopy);
      }
    };

    const handleClipboardEvent = () => {
      queueMicrotask(handleCopy);
    };

    // Verificação inicial
    if (document.hasFocus()) {
      queueMicrotask(handleCopy);
    }

    // Verificar clipboard periodicamente apenas quando a janela estiver em foco
    const intervalId = setInterval(() => {
      if (document.hasFocus()) {
        handleCopy();
      }
    }, 1000);

    document.addEventListener('copy', handleClipboardEvent);
    document.addEventListener('paste', handleClipboardEvent);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleClipboardEvent);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('copy', handleClipboardEvent);
      document.removeEventListener('paste', handleClipboardEvent);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleClipboardEvent);
    };
  }, [showAlert]);

  // Simplificar o efeito de dismiss também
  useEffect(() => {
    const handleVideoAdded = (event: CustomEvent) => {
      const addedVideoUrl = event.detail.videoUrl;
      if (addedVideoUrl) {
        processedUrls.current.add(addedVideoUrl);
        saveToStorage(addedVideoUrl); // Adiciona aqui para salvar quando o vídeo é adicionado por outros meios
        
        if (clipboardUrl === addedVideoUrl) {
          setIsExiting(true);
          
          setTimeout(() => {
            setShowAlert(false);
            setIsExiting(false);
            setVideoTitle('');
            setThumbnailUrl('');
            setClipboardUrl('');
          }, 300);
        }
      }
    };

    window.addEventListener('videoAdded', handleVideoAdded as EventListener);

    return () => {
      window.removeEventListener('videoAdded', handleVideoAdded as EventListener);
    };
  }, [clipboardUrl]);

  if (!showAlert || !clipboardUrl) return null;

  return (
    <div 
      className={`
        fixed bottom-4 right-4 
        bg-[#2d2d2d] p-4 
        rounded-lg shadow-lg 
        border border-[#404040] 
        max-w-sm z-50 
        transition-all duration-300 ease-out
        ${isExiting 
          ? 'opacity-0 translate-y-2 scale-95' 
          : 'opacity-100 translate-y-0 scale-100'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-5 h-5 text-[#e1aa1e]"
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-white font-medium">Deseja Adicionar este Vídeo?</h3>
          </div>
          <div 
            onClick={handleAdd}
            className="relative mb-2 rounded-lg overflow-hidden cursor-pointer group"
          >
            <img
              src={thumbnailUrl}
              alt={videoTitle}
              className="w-full h-auto rounded-lg transition-transform duration-300 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-white opacity-90 transition-transform duration-300 group-hover:scale-110"
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-3 break-words font-medium">
            {videoTitle}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isAdding}
              className={`bg-gradient-to-r from-[#e1aa1e] to-[#eec04b] hover:from-[#eec04b] hover:to-[#e1aa1e] text-gray-900 px-3 py-1.5 rounded-md transition-all duration-300 flex items-center justify-center gap-2 text-sm font-medium shadow-md hover:shadow-lg ${
                isAdding ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isAdding ? (
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>Adicionar Vídeo</span>
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              className="bg-[#404040] hover:bg-[#4a4a4a] text-gray-300 hover:text-white px-3 py-1.5 rounded-md transition-all duration-300 flex items-center justify-center gap-2 text-sm font-medium"
              disabled={isAdding}
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span>Ignorar</span>
            </button>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#404040] transition-all duration-300"
          disabled={isAdding}
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
      </div>
    </div>
  );
};

export default ClipboardAlert; 