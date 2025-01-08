import React, { useEffect, useState } from 'react';
import { User } from './types/auth';
import { authService } from './lib/auth';
import AudioPlayer from './components/AudioPlayer';
import VideoPlayer from './components/VideoPlayer';
import Header from './components/Header';
import Login from './components/Login';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioEnded, setAudioEnded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      setUser(user);
    } catch (error) {
      // Silenciosamente lida com o erro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (audioEnded && videoEnded) {
      // Resetar os estados
      setAudioEnded(false);
      setVideoEnded(false);
      
      // Pequeno delay antes de iniciar
      setTimeout(() => {
        setIsAudioPlaying(true);
        setIsVideoPlaying(true);
      }, 100);
    }
  }, [audioEnded, videoEnded]);

  const handleAudioEnd = () => {
    setAudioEnded(true);
    setIsAudioPlaying(false);
  };

  const handleVideoEnd = () => {
    setVideoEnded(true);
    setIsVideoPlaying(false);
  };

  // Função para sincronizar play/pause
  const handlePlayPause = (isAudio: boolean, playing: boolean) => {
    if (isAudio) {
      setIsAudioPlaying(playing);
    } else {
      setIsVideoPlaying(playing);
    }
  };

  const updateUser = async () => {
    try {
      const updatedUser = await authService.getCurrentUser();
      setUser(updatedUser);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-[#e1aa1e]">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={checkUser} />;
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      <Header 
        user={user} 
        onLogout={() => setUser(null)}
        onUserUpdate={updateUser}
      />
      <main className="container mx-auto px-4 pt-24 pb-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="w-full">
            <AudioPlayer 
              onEnded={handleAudioEnd}
              isPlaying={isAudioPlaying}
              setIsPlaying={(playing) => handlePlayPause(true, playing)}
            />
          </div>
          <div className="w-full">
            <VideoPlayer 
              onEnded={handleVideoEnd}
              isPlaying={isVideoPlaying}
              setIsPlaying={(playing) => handlePlayPause(false, playing)}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;