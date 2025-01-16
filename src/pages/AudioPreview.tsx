import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface AudioPreviewProps {}

const AudioPreview: React.FC<AudioPreviewProps> = () => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isNewAudio, setIsNewAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchTemporaryAudio = async () => {
      try {
        const { data, error } = await supabase
          .from('temporary_audios')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;

        if (data && data.audio_url) {
          setAudioUrl(data.audio_url);
        }
      } catch (err) {
        console.error('Erro ao buscar áudio:', err);
        setError('Não foi possível carregar o áudio no momento.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemporaryAudio();

    // Configurar atualização em tempo real
    const channel = supabase
      .channel('temporary_audios_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'temporary_audios'
        },
        (payload) => {
          if (payload.new && payload.new.audio_url) {
            // Ativar animação
            setIsNewAudio(true);
            
            // Atualizar URL do áudio
            setAudioUrl(payload.new.audio_url);
            
            // Reset player state
            setIsPlaying(false);
            setCurrentTime(0);
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
            }

            // Desativar animação após 1 segundo
            setTimeout(() => {
              setIsNewAudio(false);
            }, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#e1aa1e]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="bg-[#2d2d2d] p-6 rounded-lg shadow-lg text-center">
          <svg className="w-12 h-12 text-[#e1aa1e] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="bg-[#2d2d2d] p-6 rounded-lg shadow-lg text-center">
          <svg className="w-12 h-12 text-[#e1aa1e] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-gray-300">Aguardando novo áudio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center p-4">
      <div className={`bg-[#2d2d2d] p-6 rounded-lg shadow-lg w-full max-w-md transition-all duration-300 ${isNewAudio ? 'scale-105 shadow-2xl' : ''}`}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#e1aa1e] mb-2">Pré-visualização de Áudio</h1>
          <p className={`text-gray-400 text-sm transition-all duration-300 ${isNewAudio ? 'text-[#e1aa1e]' : ''}`}>
            {isNewAudio ? 'Novo áudio recebido!' : 'Este áudio ficará disponível por 5 minutos'}
          </p>
        </div>
        
        <div className={`bg-[#1e1e1e] rounded-lg p-6 shadow-inner transition-all duration-300 ${isNewAudio ? 'ring-2 ring-[#e1aa1e]' : ''}`}>
          <audio
            ref={audioRef}
            src={audioUrl}
            className="hidden"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />
          
          {/* Custom Audio Player */}
          <div className="flex flex-col gap-4">
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className={`w-16 h-16 mx-auto bg-[#e1aa1e] rounded-full flex items-center justify-center hover:bg-[#f5d485] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 ${isNewAudio ? 'animate-pulse' : ''}`}
            >
              {isPlaying ? (
                <svg className="w-8 h-8 text-[#1e1e1e]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8 text-[#1e1e1e] ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* Progress Bar */}
            <div className="flex flex-col gap-2">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSliderChange}
                className={`w-full h-2 bg-[#404040] rounded-lg appearance-none cursor-pointer accent-[#e1aa1e] transition-all duration-300 ${isNewAudio ? 'opacity-75' : ''}`}
                style={{
                  background: `linear-gradient(to right, #e1aa1e ${(currentTime / duration) * 100}%, #404040 ${(currentTime / duration) * 100}%)`
                }}
              />
              <div className="flex justify-between text-sm text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Powered by{' '}
            <span className="text-[#e1aa1e]">
              Império Fitness
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AudioPreview; 