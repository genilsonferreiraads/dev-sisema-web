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

  // Função para ordenar os vídeos baseado no histórico
  const sortedVideos = React.useMemo(() => {
    if (!lastWatchedVideos.length) return videos;

    return [...videos].sort((a, b) => {
      const indexA = lastWatchedVideos.indexOf(a.id);
      const indexB = lastWatchedVideos.indexOf(b.id);
      
      // Se não estiver no histórico, vai para o final
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
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
                  className="flex gap-2 p-2 hover:bg-[#2d2d2d] cursor-pointer rounded-lg mb-2 group"
                  onClick={() => handleVideoSelect(video)}
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={video.title || 'Thumbnail do vídeo'}
                      className="w-32 h-20 object-cover rounded border border-[#404040]"
                    />
                  ) : (
                    <div className="w-32 h-20 bg-[#2d2d2d] rounded border border-[#404040] flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-gray-400"
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#e1aa1e] truncate group-hover:text-[#e1aa1e]/80">
                      {video.title || 'Vídeo sem título'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {new Date(video.created_at).toLocaleDateString()}
                    </p>
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