import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { User } from './types/auth';
import { authService } from './lib/auth';
import AudioPlayer from './components/AudioPlayer';
import VideoPlayer from './components/VideoPlayer';
import { Header } from './components/Header';
import Login from './components/Login';
import TextToSpeech from './components/TextToSpeech';
import AudioPreview from './pages/AudioPreview';
import { supabase, videoService } from './lib/supabase';
import logo from './assets/Logo Site Império.png';
import { TTS_API_KEYS } from './config/api';
import { temporaryAudioService } from './services/temporaryAudio';

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
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [error, setError] = useState<string>('');
  const [isClipboardLoading, setIsClipboardLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInitialLoadWithoutConnection] = useState(!navigator.onLine);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const checkConnectionInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    checkUser();

    // Configurar limpeza periódica de áudios expirados
    const cleanupInterval = setInterval(() => {
      temporaryAudioService.cleanupExpiredAudios();
    }, 60000); // Executa a cada minuto

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(cleanupInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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

  const handleAddVideo = async () => {
    if (!newVideoUrl.trim() || isAddingVideo) return;

    setIsAddingVideo(true);
    try {
      const embedUrl = newVideoUrl
        .replace('watch?v=', 'embed/')
        .replace('youtu.be/', 'youtube.com/embed/');

      await videoService.addVideo(embedUrl, 'Vídeo do YouTube');
      setNewVideoUrl('');
    } catch (error) {
      console.error('Erro ao adicionar vídeo:', error);
    } finally {
      setIsAddingVideo(false);
    }
  };

  const handleClipboardVideo = async (url: string) => {
    try {
      if (!url || isClipboardLoading) {
        return;
      }

      setIsClipboardLoading(true);
      
      let videoId = '';
      if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('watch?v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      }

      if (!videoId) {
        setError('URL do YouTube inválida');
        return;
      }

      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const result = await videoService.addVideo(embedUrl, '');
      
      if (result) {
        setError('');
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      if (!navigator.onLine) {
        setError('Sem conexão com a internet');
      } else {
        setError('Erro ao adicionar vídeo');
      }
    } finally {
      setIsClipboardLoading(false);
    }
  };

  // Função para verificar a conexão
  const checkConnection = async () => {
    try {
      setIsCheckingConnection(true);
      const response = await fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        cache: 'no-store'
      });
      if (response) {
        window.location.reload();
      }
    } catch (error) {
      // Removido log desnecessário - feedback visual já existe
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Inicia a verificação automática quando estiver offline
  useEffect(() => {
    if (isInitialLoadWithoutConnection) {
      checkConnectionInterval.current = setInterval(checkConnection, 5000); // Verifica a cada 5 segundos
    }
    return () => {
      if (checkConnectionInterval.current) {
        clearInterval(checkConnectionInterval.current);
      }
    };
  }, [isInitialLoadWithoutConnection]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center">
          <img src={logo} alt="Logo" className="w-24 h-24 mx-auto mb-4" />
          <div className="animate-spin w-8 h-8 border-4 border-[#e1aa1e] border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  if (isInitialLoadWithoutConnection) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center p-4">
        <div className="relative">
          {/* Efeito de brilho de fundo */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] rounded-lg opacity-20 blur-lg animate-pulse"></div>
          
          <div className="relative bg-[#2d2d2d] p-8 rounded-lg shadow-lg max-w-md w-full border border-[#404040] backdrop-blur-xl">
            {/* Cabeçalho com Logo e Status */}
            <div className="text-center mb-8">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] rounded-full opacity-20 animate-ping"></div>
                <div className="relative w-24 h-24 rounded-full bg-[#1e1e1e] border-2 border-[#404040] p-4 flex items-center justify-center">
                  <img 
                    src={logo} 
                    alt="Logo" 
                    className="w-16 h-16 object-contain transform hover:scale-110 transition-transform duration-300"
                  />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] bg-clip-text text-transparent mb-3">
                Modo Offline
              </h2>
              
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e1e1e] border border-[#404040]">
                <div className="relative">
                  <svg className="w-5 h-5 text-[#e1aa1e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                  </svg>
                  <div className="absolute -inset-1 bg-[#e1aa1e] opacity-20 blur animate-pulse rounded-full"></div>
                </div>
                <span className="text-gray-300">Sem conexão com a internet</span>
              </div>
            </div>
            
            {/* Mensagem Principal */}
            <div className="relative mb-8">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] opacity-10 blur-sm rounded-lg"></div>
              <div className="relative bg-[#1e1e1e] p-4 rounded-lg border border-[#404040]">
                <p className="text-gray-300 text-center leading-relaxed">
                  Você está no modo offline, mas não se preocupe! 
                  <span className="block mt-1 text-[#e1aa1e]">
                    A página será recarregada automaticamente quando a conexão for restabelecida.
                  </span>
                </p>
              </div>
            </div>

            {/* Status de Verificação e Botão */}
            <div className="space-y-4">
              <div className="flex items-center justify-center text-sm">
                {isCheckingConnection ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e1e1e] border border-[#404040]">
                    <div className="w-4 h-4 relative">
                      <div className="absolute inset-0 border-2 border-[#e1aa1e] border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-0 bg-[#e1aa1e] opacity-20 blur animate-pulse rounded-full"></div>
                    </div>
                    <span className="text-[#e1aa1e]">Verificando conexão...</span>
                  </div>
                ) : (
                  <div className="px-4 py-2 rounded-full bg-[#1e1e1e] border border-[#404040] text-gray-400">
                    Verificando conexão a cada 5 segundos
                  </div>
                )}
              </div>

              <button 
                onClick={checkConnection}
                disabled={isCheckingConnection}
                className={`w-full relative group ${isCheckingConnection ? 'cursor-not-allowed' : ''}`}
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] rounded-lg opacity-70 group-hover:opacity-100 blur transition duration-300"></div>
                <div className={`relative bg-[#e1aa1e] hover:bg-[#e1aa1e]/90 px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 transform group-hover:scale-[0.99] ${isCheckingConnection ? 'opacity-50' : ''}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="font-medium text-gray-900">
                    {isCheckingConnection ? 'Verificando...' : 'Tentar Reconectar'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Se estiver na rota /audios, permite o acesso mesmo sem autenticação
    if (window.location.pathname.startsWith('/audios')) {
      return (
        <Routes>
          <Route path="/audios" element={<AudioPreview />} />
          <Route path="*" element={<Login onLoginSuccess={checkUser} />} />
        </Routes>
      );
    }
    return <Login onLoginSuccess={checkUser} />;
  }

  return (
    <Routes>
      <Route path="/audios" element={<AudioPreview />} />
      <Route path="/" element={
        <div className="min-h-screen bg-[#121212] text-white">
          <Header 
            user={user} 
            onLogout={() => setUser(null)}
            onUserUpdate={updateUser}
          />
          <main className="container mx-auto px-4 pt-24 pb-48 min-h-[calc(100vh-2rem)]">
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

          {/* Footer */}
          <footer className="relative py-6 border-t border-[#404040] bg-[#1e1e1e] shadow-lg">
            <div className="container mx-auto px-4 relative">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Logo, Nome e Endereço - Esquerda */}
                <div className="flex flex-col items-center md:items-start gap-4 md:pl-8">
                  <div className="relative group cursor-pointer">
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] rounded-lg opacity-20 group-hover:opacity-30 blur transition duration-300"></div>
                    <div className="relative flex items-center gap-3 bg-[#2d2d2d] p-3 rounded-lg border border-[#404040] group-hover:border-[#e1aa1e]/50 transition duration-300">
                      <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] rounded-full opacity-0 group-hover:opacity-50 blur transition duration-300"></div>
                        <img 
                          src={logo} 
                          alt="Logo Academia Império Fitness" 
                          className="w-12 h-12 object-contain relative transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-[#e1aa1e] font-bold text-lg group-hover:text-[#f5d485] transition-colors duration-300">
                          Academia Império Fitness
                        </h3>
                        <div className="flex items-center gap-2 text-gray-400 text-sm group-hover:text-[#e1aa1e]/80 transition-colors duration-300">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                          <span className="line-clamp-1">
                            Av. Nilo Coelho, n° 139, Cabrobó - PE
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Créditos - Centro */}
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center gap-2 group">
                    <div className="h-[1px] w-8 bg-gradient-to-r from-transparent via-[#e1aa1e]/50 to-transparent group-hover:w-12 transition-all duration-300"></div>
                    <p className="text-center">
                      <span className="relative inline-block text-sm text-gray-400 group-hover:text-[#e1aa1e] transition-colors duration-300 cursor-pointer">
                        <span className="relative z-10">Desenvolvido Por</span>
                      </span>
                    </p>
                    <div className="h-[1px] w-8 bg-gradient-to-r from-transparent via-[#e1aa1e]/50 to-transparent group-hover:w-12 transition-all duration-300"></div>
                  </div>
                  <p className="text-center">
                    <span className="relative inline-block font-medium text-base bg-gradient-to-r from-[#e1aa1e] via-[#f5d485] to-[#e1aa1e] bg-clip-text text-transparent hover:scale-105 transition-transform duration-300 cursor-pointer
                      before:content-[''] before:absolute before:-inset-1 before:bg-[#e1aa1e]/0 hover:before:bg-[#e1aa1e]/5 before:rounded-lg before:transition-all before:duration-300">
                      © {new Date().getFullYear()} Genilson Ferreira
                    </span>
                  </p>
                </div>

                {/* Redes Sociais - Direita */}
                <div className="flex flex-col items-center md:items-center gap-4 md:pr-8">
                  <div className="relative group cursor-default">
                    <div className="absolute -inset-2 bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] rounded-lg opacity-0 group-hover:opacity-20 blur transition duration-300"></div>
                    <h3 className="relative text-[#e1aa1e] font-bold text-lg">
                      Nossas Redes Sociais
                      <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#e1aa1e] group-hover:w-full transition-all duration-300"></div>
                    </h3>
                  </div>
                  <div className="flex items-center gap-6">
                    <a 
                      href="https://www.instagram.com/imperiofitness.pe" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="relative group"
                    >
                      <div className="absolute -inset-2 bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] rounded-lg opacity-0 group-hover:opacity-20 blur transition duration-300"></div>
                      <div className="relative bg-[#2d2d2d] p-2 rounded-lg border border-[#404040] group-hover:border-[#e1aa1e]/50 transition duration-300">
                        <svg 
                          className="w-6 h-6 text-gray-400 group-hover:text-[#e1aa1e] transition-all duration-300 transform group-hover:scale-110" 
                          fill="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </div>
                    </a>
                    <a 
                      href="https://wa.me/5587999880126" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="relative group"
                      title="Fale conosco no WhatsApp"
                    >
                      <div className="absolute -inset-2 bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] rounded-lg opacity-0 group-hover:opacity-20 blur transition duration-300"></div>
                      <div className="relative bg-[#2d2d2d] p-2 rounded-lg border border-[#404040] group-hover:border-[#e1aa1e]/50 transition duration-300">
                        <svg 
                          className="w-6 h-6 text-gray-400 group-hover:text-[#e1aa1e] transition-all duration-300 transform group-hover:scale-110" 
                          fill="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                        </svg>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </footer>

          <TextToSpeech 
            isOpen={showTextToSpeech}
            onClose={() => setShowTextToSpeech(false)}
            onPlayingChange={setIsAudioPlaying}
          />
        </div>
      } />
    </Routes>
  );
};

export default App;