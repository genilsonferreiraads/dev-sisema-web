import React, { useEffect, useState } from 'react';
import { User } from './types/auth';
import { authService } from './lib/auth';
import AudioPlayer from './components/AudioPlayer';
import VideoPlayer from './components/VideoPlayer';
import { Header } from './components/Header';
import Login from './components/Login';
import TextToSpeech from './components/TextToSpeech';
import { supabase } from './lib/supabase';
import logo from './assets/Logo Site Império.png';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioEnded, setAudioEnded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [pendingVideoId, setPendingVideoId] = useState<string | undefined>(undefined);
  const [showTextToSpeech, setShowTextToSpeech] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      // Primeiro verifica se há uma sessão
      const { data: session } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        return;
      }

      const user = await authService.getCurrentUser();
      if (!user) {
        setUser(null);
        // Força logout se não houver usuário válido
        await authService.signOut();
      } else {
        setUser(user);
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
      setUser(null);
      await authService.signOut();
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    if (!isInitialLoad && audioEnded && videoEnded) {
      // Resetar os estados
      setAudioEnded(false);
      setVideoEnded(false);
      
      // Pequeno delay antes de iniciar
      const timer = setTimeout(() => {
        setIsAudioPlaying(true);
        setIsVideoPlaying(true);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [audioEnded, videoEnded, isInitialLoad]);

  const handleAudioEnd = () => {
    setAudioEnded(true);
    setIsAudioPlaying(false);
  };

  const handleVideoEnd = () => {
    setVideoEnded(true);
    setIsVideoPlaying(false);
  };

  // Função para sincronizar play/pause com tratamento de erros
  const handlePlayPause = (isAudio: boolean, playing: boolean) => {
    try {
      if (isAudio) {
        if (playing && isVideoPlaying) {
          // Se está iniciando o áudio e o vídeo está tocando, pausa o vídeo primeiro
          setIsVideoPlaying(false);
          setTimeout(() => {
            setIsAudioPlaying(playing);
          }, 100);
        } else {
          setIsAudioPlaying(playing);
        }
      } else {
        if (playing && isAudioPlaying) {
          // Se está iniciando o vídeo e o áudio está tocando, pausa o áudio primeiro
          setIsAudioPlaying(false);
          setTimeout(() => {
            setIsVideoPlaying(playing);
          }, 100);
        } else {
          setIsVideoPlaying(playing);
        }
      }
    } catch (error) {
      console.error('Erro ao sincronizar áudio/vídeo:', error);
      // Reseta os estados em caso de erro
      setIsAudioPlaying(false);
      setIsVideoPlaying(false);
    }
  };

  useEffect(() => {
    // Limpa os estados quando o componente é desmontado
    return () => {
      setIsAudioPlaying(false);
      setIsVideoPlaying(false);
      setAudioEnded(false);
      setVideoEnded(false);
    };
  }, []);

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
        <div className="relative flex items-center justify-center">
          {/* Spinner principal */}
          <div className="w-16 h-16 border-4 border-[#404040] border-t-[#e1aa1e] rounded-full animate-spin"></div>
          
          {/* Logo no centro */}
          <div className="absolute">
            <div className="w-8 h-8 rounded-full bg-[#1e1e1e] border border-[#404040] flex items-center justify-center overflow-hidden">
              <img 
                src={logo} 
                alt="Império Fitness Logo" 
                className="w-6 h-6 object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={checkUser} />;
  }

  return (
    <div className="min-h-screen bg-[#121212]">
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
              setIsPlaying={(playing: boolean) => handlePlayPause(false, playing)}
              pendingVideoId={pendingVideoId}
            />
          </div>
        </div>
      </main>

      <TextToSpeech 
        apiKey="AIzaSyBvkopJSt0VaBRbqfdtevWDuCwVRDhNZ2o"
        isOpen={showTextToSpeech}
        onClose={() => setShowTextToSpeech(false)}
        onPlayingChange={setIsAudioPlaying}
      />
    </div>
  );
};

export default App;