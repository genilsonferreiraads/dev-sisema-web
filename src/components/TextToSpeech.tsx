import React, { useState, useRef, useEffect } from 'react';

interface TextToSpeechProps {
  apiKey: string;
  isOpen: boolean;
  onClose: () => void;
  onPlayingChange: (isPlaying: boolean) => void;
}

const TextToSpeech: React.FC<TextToSpeechProps> = ({ apiKey, isOpen, onClose, onPlayingChange }) => {
  console.log('API Key recebida:', apiKey ? 'Presente' : 'Ausente', 'Comprimento:', apiKey?.length);

  const [text, setText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedText, setLastGeneratedText] = useState<string>('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const notifyAudioStart = () => {
    console.log('Iniciando áudio');
    setIsAudioPlaying(true);
    onPlayingChange(true);
    window.dispatchEvent(new Event('audioPlay'));
  };

  const notifyAudioEnd = () => {
    console.log('Finalizando áudio');
    setIsAudioPlaying(false);
    onPlayingChange(false);
    window.dispatchEvent(new Event('audioStop'));
  };

  const setupAudioElement = async (url: string): Promise<void> => {
    if (audioRef.current) {
      if (!audioRef.current.paused) {
        audioRef.current.pause();
        notifyAudioEnd();
      }

      audioRef.current.src = url;
      
      audioRef.current.addEventListener('play', notifyAudioStart);
      audioRef.current.addEventListener('pause', notifyAudioEnd);
      audioRef.current.addEventListener('ended', notifyAudioEnd);

      await new Promise((resolve) => {
        audioRef.current!.addEventListener('canplaythrough', resolve, { once: true });
        audioRef.current!.load();
      });
    }
  };

  const playExistingAudio = async () => {
    if (audioRef.current && audioUrl) {
      try {
        // Garante que o áudio está configurado
        await setupAudioElement(audioUrl);
        
        // Reseta para o início
        audioRef.current.currentTime = 0;
        
        // Reproduz o áudio
        await audioRef.current.play();
      } catch (error) {
        console.error('Erro ao reproduzir áudio:', error);
        setLastGeneratedText('');
        setAudioUrl(null);
        generateSpeech();
      }
    }
  };

  const generateSpeech = async () => {
    if (!text.trim()) {
      setError('Por favor, digite algum texto');
      return;
    }

    if (!apiKey) {
      setError('Chave da API não configurada');
      return;
    }

    if (text === lastGeneratedText && audioUrl) {
      playExistingAudio();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: 'pt-BR',
              name: 'pt-BR-Wavenet-D',
              ssmlGender: 'FEMALE'
            },
            audioConfig: {
              audioEncoding: 'MP3',
              pitch: 1.0,
              speakingRate: 1.05,
              volumeGainDb: 3.0,
              effectsProfileId: ['headphone-class-device']
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Erro da API:', errorData);
        throw new Error(errorData?.error?.message || 'Erro ao gerar áudio');
      }

      const { audioContent } = await response.json();
      if (!audioContent) {
        throw new Error('Resposta da API não contém dados de áudio');
      }

      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      
      const url = URL.createObjectURL(audioBlob);
      
      setAudioUrl(url);
      setLastGeneratedText(text);

      await setupAudioElement(url);
      if (audioRef.current) {
        console.log('Iniciando reprodução');
        await audioRef.current.play();
        notifyAudioStart();
      }
    } catch (err) {
      console.error('Erro detalhado:', err);
      setError(err instanceof Error ? err.message : 'Erro ao gerar áudio. Tente novamente.');
      setLastGeneratedText('');
      setAudioUrl(null);
      notifyAudioEnd();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  };

  const handleClose = () => {
    onClose();
  };

  useEffect(() => {
    // Cria o elemento de áudio se não existir
    if (!audioRef.current) {
      const audio = document.createElement('audio');
      audio.className = 'hidden';
      document.body.appendChild(audio);
      audioRef.current = audio;

      // Adiciona os listeners uma única vez
      audio.addEventListener('play', notifyAudioStart);
      audio.addEventListener('ended', notifyAudioEnd);
      audio.addEventListener('pause', notifyAudioEnd);
    }

    // Cleanup quando o componente for completamente desmontado
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', notifyAudioStart);
        audioRef.current.removeEventListener('ended', notifyAudioEnd);
        audioRef.current.removeEventListener('pause', notifyAudioEnd);
        if (!isAudioPlaying) {
          document.body.removeChild(audioRef.current);
          audioRef.current = null;
        }
      }
    };
  }, []); // Executa apenas uma vez na montagem

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'audio.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', notifyAudioStart);
        audioRef.current.removeEventListener('pause', notifyAudioEnd);
        audioRef.current.removeEventListener('ended', notifyAudioEnd);
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="max-w-2xl w-full mx-4 animate-fadeIn">
        <div className="bg-[#1e1e1e] text-gray-300 rounded-lg shadow-lg overflow-hidden border border-[#404040]/30">
          <div className="bg-gradient-to-r from-[#2d2d2d] to-[#262626] px-6 py-4 border-b border-[#404040] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg 
                className="w-5 h-5 text-[#e1aa1e] animate-pulse" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
                />
              </svg>
              <h2 className="text-lg font-medium bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] bg-clip-text text-transparent">
                Digite o texto para falar
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-200 transition-all duration-300 hover:rotate-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="relative group">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite aqui o texto que você quer que seja falado..."
                className="w-full h-24 bg-[#2d2d2d] border border-[#404040] text-gray-200 rounded-lg px-4 py-3 focus:border-[#e1aa1e] focus:outline-none resize-none transition-all duration-300 focus:shadow-[0_0_10px_rgba(225,170,30,0.3)] group-hover:border-[#e1aa1e]/50"
                disabled={isLoading}
              />
              {error && (
                <p className="absolute -bottom-6 left-0 text-red-400 text-sm animate-fadeIn">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={isAudioPlaying ? handlePause : (text === lastGeneratedText && audioUrl ? handlePlay : generateSpeech)}
                disabled={isLoading}
                className={`
                  flex-1 relative overflow-hidden group ${
                    isLoading 
                      ? 'bg-[#e1aa1e]/50 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] hover:from-[#f5d485] hover:to-[#e1aa1e]'
                  } text-gray-900 px-3 py-2 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 font-medium whitespace-nowrap shadow-lg hover:shadow-[0_0_15px_rgba(225,170,30,0.4)]`}
              >
                {isLoading ? (
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
                    <span>Gerando...</span>
                  </>
                ) : isAudioPlaying ? (
                  <>
                    <svg 
                      className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <svg 
                      className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
                      />
                    </svg>
                    <span className="truncate relative z-10">
                      {text === lastGeneratedText && audioUrl ? 'Repetir Fala' : 'Falar Texto'}
                    </span>
                  </>
                )}
              </button>

              {audioUrl && (
                <button
                  onClick={handleDownload}
                  className="bg-[#2d2d2d] hover:bg-[#404040] border border-[#404040] text-[#e1aa1e] px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 font-medium hover:border-[#e1aa1e] hover:text-[#f5d485] hover:shadow-[0_0_10px_rgba(225,170,30,0.2)] group"
                >
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Baixar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextToSpeech; 