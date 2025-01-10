import React, { useEffect, useRef } from 'react';
import { VideoData } from '../lib/supabase';

interface VideoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoData[];
  onVideoSelect: (video: VideoData, autoplay: boolean) => void;
  setIsPlaying?: (playing: boolean) => void;
  lastWatchedVideos?: string[];
}

const VideoSidebar: React.FC<VideoSidebarProps> = ({ 
  isOpen, 
  onClose, 
  videos,
  onVideoSelect,
  setIsPlaying = () => {},
  lastWatchedVideos = []
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && 
          sidebarRef.current && 
          !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Função para extrair o ID do vídeo da URL
  const getVideoThumbnail = (url: string) => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtube.com')
          ? url.split('embed/')[1]?.split('?')[0]
          : url.split('youtu.be/')[1]?.split('?')[0];
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleVideoSelect = (video: VideoData) => {
    onVideoSelect(video, true);
    onClose();
  };

  // Função para ordenar os vídeos baseado no histórico e remover duplicatas
  const sortedVideos = React.useMemo(() => {
    const MAX_VIDEOS = 30; // Alterado para 30 vídeos

    if (!lastWatchedVideos.length) {
      // Remove duplicatas da lista original usando a URL como chave
      const uniqueVideos = videos.filter((video, index, self) =>
        index === self.findIndex((v) => v.url === video.url)
      );
      // Retorna apenas os 30 últimos vídeos
      return uniqueVideos.slice(0, MAX_VIDEOS);
    }

    // Primeiro remove as duplicatas
    const uniqueVideos = videos.filter((video, index, self) =>
      index === self.findIndex((v) => v.url === video.url)
    );

    // Depois ordena baseado no histórico
    const orderedVideos = [...uniqueVideos].sort((a, b) => {
      const indexA = lastWatchedVideos.indexOf(a.id);
      const indexB = lastWatchedVideos.indexOf(b.id);
      
      // Se não estiver no histórico, vai para o final
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });

    // Retorna apenas os 30 primeiros vídeos
    return orderedVideos.slice(0, MAX_VIDEOS);
  }, [videos, lastWatchedVideos]);

  return (
    <>
      {/* Overlay escuro quando o sidebar está aberto */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      )}
      
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed right-0 top-0 h-full w-80 bg-[#1e1e1e] shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-[#e1aa1e]">Últimos Vídeos</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-[#e1aa1e] transition-colors"
            >
              <svg
                className="w-6 h-6"
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
          <div className="overflow-y-auto max-h-[calc(100vh-100px)]">
            {sortedVideos.map((video) => {
              const thumbnail = getVideoThumbnail(video.url);
              return (
                <div
                  key={video.id}
                  className="p-2 hover:bg-[#2d2d2d] cursor-pointer rounded-lg mb-2 group transition-all duration-300 hover:border-[#e1aa1e] border border-transparent"
                  onClick={() => handleVideoSelect(video)}
                >
                  <p className="text-sm font-medium text-white mb-1.5 break-words group-hover:text-white px-1 transition-colors duration-300">
                    {video.title || 'Vídeo sem título'}
                  </p>
                  <div className="flex justify-center overflow-hidden rounded-lg">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={video.title || 'Thumbnail do vídeo'}
                        className="w-full max-w-[280px] h-[157px] object-cover border border-[#404040] flex-shrink-0 transition-transform duration-300 group-hover:scale-105 group-hover:border-[#e1aa1e]"
                      />
                    ) : (
                      <div className="w-full max-w-[280px] h-[157px] bg-[#2d2d2d] border border-[#404040] flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:border-[#e1aa1e]">
                        <svg
                          className="w-8 h-8 text-gray-400 transition-colors duration-300 group-hover:text-[#e1aa1e]"
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoSidebar; 