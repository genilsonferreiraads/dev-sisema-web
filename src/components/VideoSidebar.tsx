import React from 'react';
import { VideoData } from '../lib/supabase';

interface VideoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoData[];
  onVideoSelect: (video: VideoData) => void;
}

const VideoSidebar: React.FC<VideoSidebarProps> = ({ 
  isOpen, 
  onClose, 
  videos,
  onVideoSelect
}) => {
  // Função para extrair o ID do vídeo da URL
  const getVideoThumbnail = (url: string) => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtube.com')
          ? url.split('embed/')[1]?.split('?')[0]
          : url.split('youtu.be/')[1]?.split('?')[0];
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
      // Para Vimeo precisaríamos fazer uma chamada à API deles
      return null;
    } catch {
      return null;
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`fixed right-0 top-0 h-full w-80 bg-[#1e1e1e] border-l border-[#404040] shadow-xl transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="bg-[#1e1e1e] border-b border-[#404040]">
          <div className="px-6 py-5 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-[#e1aa1e]">Últimos Vídeos</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100vh-80px)]">
          {videos.map((video) => {
            const thumbnail = getVideoThumbnail(video.url);
            return (
              <div
                key={video.id}
                className="flex gap-3 p-3 bg-[#2d2d2d] rounded-lg border border-[#404040] hover:border-[#e1aa1e] transition-colors cursor-pointer mb-4"
                onClick={() => onVideoSelect(video)}
              >
                {/* Thumbnail do vídeo */}
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={video.title || 'Thumbnail do vídeo'}
                    className="w-32 h-20 object-cover rounded"
                  />
                ) : (
                  <div className="w-32 h-20 bg-[#1e1e1e] rounded flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}

                {/* Informações do vídeo */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-[#e1aa1e] font-medium line-clamp-2">
                    {video.title || 'Vídeo sem título'}
                  </h4>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VideoSidebar; 