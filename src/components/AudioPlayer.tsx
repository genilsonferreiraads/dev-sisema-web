import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audioService, AudioData } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import '../styles/animations.css';
import TextToSpeech from './TextToSpeech';
import { TTS_API_KEYS } from '../config/api';

interface AudioTimer {
  interval: number;
  timeLeft: number;
  intervalId: NodeJS.Timeout;
  endTime: string;
}

interface AudioPlayerProps {
  onEnded: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ onEnded, isPlaying: externalIsPlaying, setIsPlaying: setExternalIsPlaying }) => {
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [currentAudio, setCurrentAudio] = useState<AudioData | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioTimers, setAudioTimers] = useState<Record<string, AudioTimer>>({});
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [timerAudioId, setTimerAudioId] = useState<string | null>(null);
  const [pendingAudioId, setPendingAudioId] = useState<string | null>(null);
  const [pendingAudios, setPendingAudios] = useState<string[]>([]);
  const playAttemptRef = useRef<NodeJS.Timeout | null>(null);
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);
  const [showTimerDialog, setShowTimerDialog] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [confirmPosition, setConfirmPosition] = useState<{ x: number; y: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [timerInputValue, setTimerInputValue] = useState('');
  const [preferences, setPreferences] = useState<Record<string, {
    auto_repeat: boolean;
    repeat_interval: number;
    last_played_at?: string;
    play_count: number;
  }>>({});
  const [playAttempts, setPlayAttempts] = useState(0);
  const MAX_PLAY_ATTEMPTS = 3;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletePosition, setDeletePosition] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const endTimeRefs = useRef<Record<string, string>>({});
  const [isTextToSpeechOpen, setIsTextToSpeechOpen] = useState(false);
  const [isTextToSpeechSpeaking, setIsTextToSpeechSpeaking] = useState(false);
  const [pinnedAudios, setPinnedAudios] = useState<string[]>([]);
  const [showPinConfirm, setShowPinConfirm] = useState<string | null>(null);
  const [pinConfirmPosition, setPinConfirmPosition] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Adiciona useEffect para limpar a mensagem de erro
  useEffect(() => {
    if (uploadError) {
      const timer = setTimeout(() => {
        setUploadError(null);
      }, 5000); // 5 segundos

      return () => clearTimeout(timer);
    }
  }, [uploadError]);

  useEffect(() => {
    loadAudios();
    return () => {
      if (canvasRef.current) {
        canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, []);

  const loadAudios = async () => {
    try {
      const data = await audioService.getAudios();
      // Ordena os áudios fixados por pinned_at
      const sortedData = [...data].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        if (a.is_pinned && b.is_pinned) {
          return new Date(b.pinned_at!).getTime() - new Date(a.pinned_at!).getTime();
        }
        return 0;
      });
      setAudios(sortedData);
      
      // Atualiza o estado dos áudios fixados
      setPinnedAudios(sortedData.filter(audio => audio.is_pinned).map(audio => audio.id));
      
      // Carrega as preferências para cada áudio
      data.forEach(audio => {
        loadAudioPreferences(audio.id);
      });
    } catch (error) {
      console.error('Erro ao carregar áudios:', error);
    }
  };

  const loadAudioPreferences = async (audioId: string) => {
    try {
      const prefs = await audioService.loadPreferences(audioId);
      
      if (prefs.auto_repeat && prefs.timer_end_at) {
        const endTime = new Date(prefs.timer_end_at).getTime();
        const now = Date.now();
        const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));

        // Se ainda há tempo restante ou se acabou de terminar
        if (timeLeft >= 0) {
          const interval = prefs.repeat_interval * 60;
          
          // Se o timer acabou de terminar, cria um novo ciclo
          if (timeLeft === 0) {
            const newEndTime = new Date(Date.now() + interval * 1000).toISOString();
            
            // Atualiza o endTime no banco
            await audioService.updatePreferences(audioId, {
              ...prefs,
              timer_end_at: newEndTime
            });

            // Inicia novo ciclo com o novo endTime
            startNewTimerCycle(audioId, interval, newEndTime);
          } else {
            // Continua o ciclo atual com o tempo restante
            startNewTimerCycle(audioId, interval, prefs.timer_end_at);
          }
        } else {
          // Se o timer expirou há muito tempo, desativa-o
          await audioService.updatePreferences(audioId, {
            auto_repeat: false,
            timer_end_at: undefined,
            repeat_interval: 0
          });
        }
      }

      // Atualiza as preferências locais
      setPreferences(prev => ({
        ...prev,
        [audioId]: {
          auto_repeat: prefs.auto_repeat || false,
          repeat_interval: prefs.repeat_interval || 0,
          last_played_at: prefs.last_played_at,
          play_count: prefs.play_count || 0
        }
      }));

    } catch (error) {
      // Mantém o erro silencioso
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current) {
      const bounds = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const width = bounds.width;
      const percentage = x / width;
      audioRef.current.currentTime = audioRef.current.duration * percentage;
    }
  };

  const startNewTimerCycle = (audioId: string, interval: number, existingEndTime?: string) => {
    endTimeRefs.current[audioId] = existingEndTime || new Date(Date.now() + interval * 1000).toISOString();
    const initialTimeLeft = Math.max(0, Math.floor((new Date(endTimeRefs.current[audioId]).getTime() - Date.now()) / 1000));
    
    if (timersRef.current[audioId]) {
      clearInterval(timersRef.current[audioId]);
    }

    let attemptCount = 0;
    const MAX_ATTEMPTS = 3;

    const createNewCycle = async () => {
      try {
        if (isPlayingRef.current) {
          if (attemptCount < MAX_ATTEMPTS) {
            attemptCount++;
            setTimeout(() => createNewCycle(), 1000);
          } else {
            isPlayingRef.current = false;
          }
          return;
        }

        isPlayingRef.current = true;
        attemptCount = 0;
        
        const audioData = await audioService.getAudio(audioId);
        if (!audioData) {
          isPlayingRef.current = false;
          return;
        }

        // Primeiro atualiza as preferências
        const newEndTime = new Date(Date.now() + interval * 1000).toISOString();
        await audioService.updatePreferences(audioId, {
          auto_repeat: true,
          repeat_interval: interval / 60,
          timer_end_at: newEndTime
        });

        endTimeRefs.current[audioId] = newEndTime;

        // Depois prepara o áudio
        if (audioRef.current) {
          audioRef.current.src = audioData.url;
          audioRef.current.currentTime = 0;

          // Aguarda o áudio estar pronto
          await new Promise((resolve) => {
            audioRef.current!.addEventListener('canplay', resolve, { once: true });
          });

          setCurrentAudio(audioData);
          setExternalIsPlaying(true);

          try {
            await audioRef.current.play();
          } catch (error) {
            isPlayingRef.current = false;
            setExternalIsPlaying(false);
            return;
          }
        }

        // Libera para próxima reprodução quando este áudio terminar
        audioRef.current?.addEventListener('ended', () => {
          isPlayingRef.current = false;
          setExternalIsPlaying(false);
        }, { once: true });

      } catch (error) {
        isPlayingRef.current = false;
        setExternalIsPlaying(false);
      }
    };

    const intervalId = setInterval(() => {
      const currentTime = Date.now();
      const timerEndTime = new Date(endTimeRefs.current[audioId]).getTime();
      const newTimeLeft = Math.max(0, Math.floor((timerEndTime - currentTime) / 1000));

      if (newTimeLeft === 0 && !isPlayingRef.current) {
        createNewCycle();
      }

      setAudioTimers(prev => ({
        ...prev,
        [audioId]: {
          interval,
          timeLeft: newTimeLeft,
          intervalId,
          endTime: endTimeRefs.current[audioId]
        }
      }));
    }, 1000);

    timersRef.current[audioId] = intervalId;

    setAudioTimers(prev => ({
      ...prev,
      [audioId]: {
        interval,
        timeLeft: initialTimeLeft,
        intervalId,
        endTime: endTimeRefs.current[audioId]
      }
    }));

    if (initialTimeLeft === 0) {
      createNewCycle();
    }

    return intervalId;
  };

  const handleAudioEnd = () => {
    isPlayingRef.current = false;
    setExternalIsPlaying(false);
    if (onEnded) {
      onEnded();
    }
  };

  const handlePlayPause = async () => {
    try {
      if (!audioRef.current) return;

      if (externalIsPlaying) {
        await audioRef.current.pause();
        setExternalIsPlaying(false);
      } else {
        try {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
            setExternalIsPlaying(true);
          }
        } catch (error) {
          console.error('Erro ao reproduzir áudio:', error);
          setExternalIsPlaying(false);
        }
      }
    } catch (error) {
      console.error('Erro ao controlar reprodução:', error);
      setExternalIsPlaying(false);
    }
  };

  const playAudio = () => {
    if (!audioRef.current) return;
    
    audioRef.current.play()
      .then(() => setExternalIsPlaying(true))
      .catch(error => {
        console.error('Erro ao reproduzir áudio:', error);
        setExternalIsPlaying(false);
      });
  };

  const togglePlay = (audio: AudioData) => {
    if (!audioRef.current) return;

    if (currentAudio?.id !== audio.id) {
      // Novo áudio selecionado
      if (currentAudio) {
        audioRef.current.pause();
      }
      setCurrentAudio(audio);
      
      // Remove qualquer listener anterior
      audioRef.current.removeEventListener('loadeddata', playAudio);
      
      // Define o novo src
      audioRef.current.src = audio.url;
      
      // Adiciona o listener para reproduzir quando o áudio estiver pronto
      audioRef.current.addEventListener('loadeddata', playAudio, { once: true });
      
      // Inicia o carregamento
      audioRef.current.load();
    } else {
      // Mesmo áudio - toggle play/pause
      if (!externalIsPlaying) {
        playAudio();
      } else {
        audioRef.current.pause();
        setExternalIsPlaying(false);
      }
    }
  };

  // Função para sanitizar o nome do arquivo
  const sanitizeFileName = (fileName: string): string => {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-zA-Z0-9.]/g, '_')  // Substitui caracteres especiais por _
      .replace(/_+/g, '_')             // Remove underscores múltiplos
      .toLowerCase();                   // Converte para minúsculas
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    // Sanitiza o nome do arquivo para evitar problemas com caracteres especiais
    const sanitizedName = sanitizeFileName(file.name);
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      // Verifica se o arquivo já existe
      const { data: existingFiles } = await supabase.storage
        .from('audios')
        .list();

      const fileExists = existingFiles?.some(existingFile => 
        existingFile.name === sanitizedName
      );

      if (fileExists) {
        setUploadError(`O áudio "${file.name}" já existe. Por favor, escolha outro nome ou renomeie o arquivo antes de enviar.`);
        return;
      }

      // Upload do arquivo para o bucket 'audios'
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audios')
        .upload(sanitizedName, file);

      if (uploadError) {
        if (uploadError.message.includes('duplicate')) {
          setUploadError(`O áudio "${file.name}" já existe. Por favor, escolha outro nome ou renomeie o arquivo antes de enviar.`);
        } else {
          throw uploadError;
        }
        return;
      }

      // Obtém a URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('audios')
        .getPublicUrl(sanitizedName);

      // Salva a referência no banco de dados
      const { error: dbError } = await supabase
        .from('audios')
        .insert([
          {
            title: file.name, // Mantém o nome original como título
            url: publicUrl
          }
        ]);

      if (dbError) throw dbError;

      loadAudios();
    } catch (error) {
      console.error('Erro ao fazer upload do áudio:', error);
      setUploadError('Ocorreu um erro ao enviar o áudio. Por favor, tente novamente.');
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const startRepeatTimer = async (audioId: string, minutes: number) => {
    setTimerAudioId(audioId);
    const seconds = minutes * 60;
    
    // Inicia o novo ciclo do timer
    startNewTimerCycle(audioId, seconds);

    // Calcula o tempo de término
    const endTime = new Date(Date.now() + seconds * 1000).toISOString();

    // Salva as preferências no banco
    try {
      const prefs = {
        auto_repeat: true,
        repeat_interval: minutes,
        timer_end_at: endTime
      };
      
      await audioService.updatePreferences(audioId, prefs);
      
      // Atualiza também as preferências locais
      setPreferences(prev => ({
        ...prev,
        [audioId]: {
          ...prev[audioId],
          auto_repeat: true,
          repeat_interval: minutes
        }
      }));
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    }
  };

  const stopRepeatTimer = async (audioId: string) => {
    // Não para o timer se o áudio estiver tocando
    if (currentAudio?.id === audioId && externalIsPlaying) {
      return;
    }

    if (timersRef.current[audioId]) {
      clearInterval(timersRef.current[audioId]);
      delete timersRef.current[audioId];
    }

    setAudioTimers(prev => {
      const newTimers = { ...prev };
      delete newTimers[audioId];
      return newTimers;
    });

    try {
      const prefs = {
        auto_repeat: false,
        repeat_interval: 0,
        timer_end_at: undefined
      };
      
      await audioService.updatePreferences(audioId, prefs);
      
      // Atualiza também as preferências locais
      setPreferences(prev => ({
        ...prev,
        [audioId]: {
          ...prev[audioId],
          auto_repeat: false,
          repeat_interval: 0
        }
      }));
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    }
  };

  const handleDelete = async (audioId: string) => {
    try {
      const audioToDelete = audios.find(a => a.id === audioId);
      if (!audioToDelete) return;

      const fileUrl = audioToDelete.url;
      const fileName = fileUrl.split('/').pop()?.split('?')[0];
      
      if (!fileName) {
        console.error('Nome do arquivo não encontrado na URL');
        return;
      }

      const { error: deleteError } = await supabase.storage
        .from('audios')
        .remove([fileName]);

      if (deleteError) {
        console.error('Erro ao deletar arquivo:', deleteError);
        return;
      }

      // Remove o registro do banco de dados
      await audioService.deleteAudio(audioId);

      // Atualiza estados locais
      if (currentAudio?.id === audioId) {
        setCurrentAudio(null);
        setExternalIsPlaying(false);
      }

      if (audioTimers[audioId]) {
        await stopRepeatTimer(audioId);
      }

      setPreferences(prev => {
        const newPrefs = { ...prev };
        delete newPrefs[audioId];
        return newPrefs;
      });

      // Recarrega a lista de áudios
      await loadAudios();

    } catch (error) {
      console.error('Erro ao deletar áudio:', error);
      try {
        await loadAudios();
      } catch (e) {
        console.error('Erro ao recarregar áudios após falha:', e);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Adicione esta função auxiliar para formatar o tempo do timer
  const formatTimeLeft = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.ceil(seconds)} Segundos`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.ceil(seconds % 60);
    return `${minutes}min ${remainingSeconds}s`;
  };

  // Modifique a função getNextAudioInfo para verificar os timers ativos
  const getNextAudioInfo = () => {
    // Primeiro, verifica se há algum áudio pendente na fila
    if (pendingAudios.length > 0) {
      const nextAudioId = pendingAudios[0];
      const nextAudio = audios.find(a => a.id === nextAudioId);
      const timer = audioTimers[nextAudioId];
      
      return { nextAudio, timer };
    }

    // Se não há áudios pendentes, procura o próximo áudio agendado
    let nextScheduledAudio = null;
    let shortestTime = Infinity;

    Object.entries(audioTimers).forEach(([audioId, timer]) => {
      if (timer.timeLeft < shortestTime) {
        const audio = audios.find(a => a.id === audioId);
        if (audio) {
          nextScheduledAudio = {
            nextAudio: audio,
            timer: timer
          };
          shortestTime = timer.timeLeft;
        }
      }
    });

    return nextScheduledAudio;
  };

  const handleUpdateTitle = async (audioId: string, newTitle: string) => {
    try {
      const updatedAudio = await audioService.renameAudioFile(audioId, newTitle);
      // Atualiza o estado local dos áudios
      setAudios(prev => prev.map(audio => 
        audio.id === audioId ? updatedAudio : audio
      ));
      // Se o áudio sendo editado é o atual, atualiza também o currentAudio
      if (currentAudio?.id === audioId) {
        setCurrentAudio(updatedAudio);
      }
      setEditingAudioId(null);
    } catch (error) {
      console.error('Erro ao renomear arquivo de áudio:', error);
    }
  };

  const ConfirmDialog = ({ 
    audioId, 
    onConfirm,
    onEdit,
    onCancel,
    buttonPosition
  }: { 
    audioId: string;
    onConfirm: () => void;
    onEdit: () => void;
    onCancel: () => void;
    buttonPosition: { x: number; y: number } | null;
  }) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center" 
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <div 
          className={`
            bg-[#2d2d2d] border border-[#404040] shadow-lg rounded-lg mx-4
            ${isMobile ? 'w-[280px]' : 'w-64'}
            p-4
          `}
          style={!isMobile ? {
            position: 'absolute',
            top: buttonPosition ? `${buttonPosition.y - 80}px` : '50%',
            left: buttonPosition ? `${buttonPosition.x - 100}px` : '50%'
          } : undefined}
        >
          <h3 className="text-[#e1aa1e] font-medium text-sm mb-2">Gerenciar Repetição</h3>
          <p className="text-gray-300 text-xs mb-4">
            Escolha uma das opções para editar a repetição automática:
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className={`
                px-3 rounded bg-[#404040] text-gray-200 hover:bg-[#505050] transition-colors
                ${isMobile ? 'py-2 text-sm' : 'py-1.5 text-xs'}
              `}
            >
              Cancelar
            </button>
            <button
              onClick={onEdit}
              className={`
                px-3 rounded bg-[#e1aa1e]/20 text-[#e1aa1e] hover:bg-[#e1aa1e]/30 transition-colors
                ${isMobile ? 'py-2 text-sm' : 'py-1.5 text-xs'}
              `}
            >
              Editar
            </button>
            <button
              onClick={onConfirm}
              className={`
                px-3 rounded bg-[#e1aa1e] text-gray-900 hover:bg-[#e1aa1e]/80 transition-colors
                ${isMobile ? 'py-2 text-sm' : 'py-1.5 text-xs'}
              `}
            >
              Desativar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const SetTimerDialog = ({ 
    audioId, 
    audioTitle,
    onConfirm, 
    onCancel,
    buttonPosition,
    inputValue,
    onInputChange
  }: { 
    audioId: string;
    audioTitle: string;
    onConfirm: (minutes: number) => void;
    onCancel: () => void;
    buttonPosition: { x: number; y: number } | null;
    inputValue: string;
    onInputChange: (value: string) => void;
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

    const handleConfirm = useCallback(() => {
      const value = parseInt(inputValue);
      if (value > 0) {
        onConfirm(value);
      }
    }, [inputValue, onConfirm]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      onInputChange(e.target.value);
    }, [onInputChange]);

    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center" 
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <div 
          className={`
            bg-[#2d2d2d] border border-[#404040] shadow-lg rounded-lg mx-4
            ${isMobile ? 'w-[280px]' : 'w-64'}
            p-4
          `}
          style={!isMobile ? {
            position: 'absolute',
            top: buttonPosition ? `${buttonPosition.y - 80}px` : '50%',
            left: buttonPosition ? `${buttonPosition.x - 100}px` : '50%'
          } : undefined}
        >
          <h3 className="text-[#e1aa1e] font-medium text-sm mb-2">Repetir Áudio</h3>
          <p className="text-gray-300 text-xs mb-3 truncate">
            {audioTitle}
          </p>
          
          <div className="relative mb-4">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="1"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="00"
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#404040] rounded text-gray-200 text-center text-sm focus:border-[#e1aa1e] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-12"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                } else if (e.key === 'Escape') {
                  onCancel();
                }
              }}
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              minutos
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className={`
                px-3 rounded bg-[#404040] text-gray-200 hover:bg-[#505050] transition-colors
                ${isMobile ? 'py-2 text-sm' : 'py-1.5 text-xs'}
              `}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!inputValue || parseInt(inputValue) <= 0}
              className={`
                px-3 rounded bg-[#e1aa1e] text-gray-900 hover:bg-[#e1aa1e]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                ${isMobile ? 'py-2 text-sm' : 'py-1.5 text-xs'}
              `}
            >
              Ativar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleShowTimerDialog = (e: React.MouseEvent, audioId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopupPosition({ 
      x: rect.left + rect.width/2, 
      y: rect.top + rect.height/2 
    });
    setIsAnimating(true);
    setTimeout(() => {
      setIsAnimating(false);
      setShowTimerDialog(audioId);
    }, 10);
  };

  const handleShowConfirmDialog = (e: React.MouseEvent, audioId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setConfirmPosition({ 
      x: rect.left + rect.width/2, 
      y: rect.top + rect.height/2 
    });
    setIsAnimating(true);
    setTimeout(() => {
      setIsAnimating(false);
      setShowConfirmDialog(audioId);
    }, 10);
  };

  // Adicione este useEffect para gerenciar a seleção de texto
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .dragging * {
        user-select: none !important;
        -webkit-user-select: none !important;
        cursor: grabbing !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const DeleteConfirmDialog = ({ 
    audioId, 
    onConfirm,
    onCancel,
    buttonPosition
  }: { 
    audioId: string;
    onConfirm: () => void;
    onCancel: () => void;
    buttonPosition: { x: number; y: number } | null;
  }) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center" 
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <div 
          className={`
            bg-[#2d2d2d] border border-[#404040] shadow-lg rounded-lg mx-4
            ${isMobile ? 'w-[280px]' : 'w-64'}
            p-4
          `}
          style={!isMobile ? {
            position: 'absolute',
            top: buttonPosition ? `${buttonPosition.y - 80}px` : '50%',
            left: buttonPosition ? `${buttonPosition.x - 100}px` : '50%'
          } : undefined}
        >
          <h3 className="text-red-500 font-medium text-sm mb-2">Confirmar Exclusão</h3>
          <p className="text-gray-300 text-xs mb-4">
            Tem certeza que deseja excluir este áudio?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className={`
                px-3 rounded bg-[#404040] text-gray-200 hover:bg-[#505050] transition-colors
                ${isMobile ? 'py-2 text-sm' : 'py-1.5 text-xs'}
              `}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`
                px-3 rounded bg-red-500 text-white hover:bg-red-600 transition-colors
                ${isMobile ? 'py-2 text-sm' : 'py-1.5 text-xs'}
              `}
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (audioRef.current && canvasRef.current) {
      if (externalIsPlaying) {
        audioRef.current.play();
        canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      } else {
        audioRef.current.pause();
        canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [externalIsPlaying]);

  const animate = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      // Fundo com gradiente
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Número de ondas e configurações
      const waves = 3;
      const points = 100;
      const spacing = canvas.height / (waves + 1);

      // Para cada linha de onda
      for (let w = 1; w <= waves; w++) {
        const baseY = spacing * w;
        
        ctx.beginPath();
        ctx.moveTo(0, baseY);

        // Desenha a onda através da largura do canvas
        for (let x = 0; x <= canvas.width; x++) {
          const progress = x / canvas.width;
          const index = Math.floor(progress * bufferLength);
          const value = dataArray[index] / 255.0;
          
          // Amplitude varia com o áudio
          const amplitude = externalIsPlaying ? 30 * value : 10;
          
          // Frequência e fase variam com o tempo e posição
          const frequency = 0.02;
          const phase = Date.now() * 0.002 + w;
          
          // Calcula a posição Y com múltiplas ondas sobrepostas
          const y = baseY + 
                   Math.sin(x * frequency + phase) * amplitude +
                   Math.sin(x * frequency * 0.5 + phase * 1.5) * amplitude * 0.5;

          ctx.lineTo(x, y);
        }

        // Gradiente para a onda
        const gradient = ctx.createLinearGradient(0, baseY - 50, 0, baseY + 50);
        const alpha = externalIsPlaying ? (0.5 - (w - 1) * 0.1) : 0.2;
        
        gradient.addColorStop(0, `rgba(225, 170, 30, 0)`);
        gradient.addColorStop(0.5, `rgba(225, 170, 30, ${alpha})`);
        gradient.addColorStop(1, `rgba(225, 170, 30, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Efeito de brilho
        if (externalIsPlaying) {
          ctx.save();
          ctx.filter = 'blur(4px)';
          ctx.strokeStyle = `rgba(225, 170, 30, ${alpha * 0.5})`;
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Adiciona partículas brilhantes
      if (externalIsPlaying) {
        for (let i = 0; i < bufferLength; i += 8) {
          const value = dataArray[i] / 255.0;
          if (value > 0.5) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 3 * value;

            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(225, 170, 30, ${value * 0.3})`;
            ctx.fill();
          }
        }
      }
    };

    draw();
  };

  const togglePin = async (audioId: string) => {
    try {
      const audio = audios.find(a => a.id === audioId);
      if (!audio) return;

      const isPinned = !audio.is_pinned;
      const pinned_at = isPinned ? new Date().toISOString() : undefined;

      // Atualiza no banco de dados
      const { data, error } = await supabase
        .from('audios')
        .update({ 
          is_pinned: isPinned,
          pinned_at: pinned_at
        })
        .eq('id', audioId);

      if (error) throw error;

      // Atualiza o estado local
      setPinnedAudios(prev => {
        if (isPinned) {
          return [audioId, ...prev];
        } else {
          return prev.filter(id => id !== audioId);
        }
      });

      // Atualiza a lista de áudios
      setAudios(prev => prev.map(a => 
        a.id === audioId 
          ? { ...a, is_pinned: isPinned, pinned_at: pinned_at }
          : a
      ));

    } catch (error) {
      console.error('Erro ao atualizar estado fixado:', error);
    }
  };

  const PinConfirmDialog = ({ 
    audioId, 
    audioTitle,
    onConfirm,
    onCancel,
    buttonPosition,
    isPinned
  }: { 
    audioId: string;
    audioTitle: string;
    onConfirm: () => void;
    onCancel: () => void;
    buttonPosition: { x: number; y: number } | null;
    isPinned: boolean;
  }) => (
    <div className="fixed inset-0 z-50" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div 
        className="absolute bg-[#2d2d2d]/95 backdrop-blur-sm px-4 py-2.5 rounded-lg shadow-lg border border-white/10"
        style={{
          top: buttonPosition ? `${buttonPosition.y + 10}px` : '50%',
          left: buttonPosition ? `${buttonPosition.x - 90}px` : '50%',
          transform: isAnimating ? 'scale(0.95)' : 'scale(1)',
          opacity: isAnimating ? 0 : 1,
          transition: 'all 0.2s ease-out'
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="text-white/80 hover:text-white text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="text-[#e1aa1e] hover:text-[#e1aa1e]/80 text-xs font-medium transition-colors"
          >
            {isPinned ? 'Desfixar' : 'Fixar'}
          </button>
        </div>
      </div>
    </div>
  );

  const handlePin = (e: React.MouseEvent, audioId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPinConfirmPosition({ 
      x: rect.left + rect.width/2, 
      y: rect.top + rect.height/2 
    });
    setShowPinConfirm(audioId);
  };

  useEffect(() => {
    const audioElement = audioRef.current;
    
    if (audioElement) {
      const handleEnded = () => {
        setExternalIsPlaying(false);
        if (onEnded) onEnded();
      };

      audioElement.addEventListener('ended', handleEnded);
      
      return () => {
        audioElement.removeEventListener('ended', handleEnded);
      };
    }
  }, [onEnded]);

  // Quando o componente montar, garantir que o estado inicial seja correto
  useEffect(() => {
    setExternalIsPlaying(false);
  }, []);

  return (
    <div className="bg-[#1e1e1e] text-gray-300 rounded-lg shadow-lg p-3 sm:p-4 mt-10 sm:mt-0">
      {/* Player Principal com Visualizador */}
      <div className="mb-8 sm:mb-4 bg-[#2d2d2d] rounded-lg border border-[#404040] overflow-hidden">
        {/* Título do Áudio */}
        <div className="p-2.5 sm:p-3 border-b border-[#404040]">
          <h3 className="text-[#e1aa1e] font-medium text-center text-sm sm:text-base">
            {currentAudio?.title || 'Selecione um áudio'}
          </h3>
        </div>

        {/* Área do Visualizador */}
        <div className="relative h-20 sm:h-32 bg-[#1e1e1e] p-3 sm:p-4 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            width={1000}
            height={200}
          />
          
          {/* Container das ondas e botão */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Círculos de animação */}
              {externalIsPlaying && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Ondas se expandindo - ajustadas para mobile */}
                    <div className="animate-wave-1 absolute w-8 sm:w-12 h-8 sm:h-12 rounded-full border-6 sm:border-8 border-[#e1aa1e] bg-[#e1aa1e]/20" style={{ boxShadow: '0 0 20px rgba(225,170,30,0.5), inset 0 0 20px rgba(225,170,30,0.5)' }} />
                    <div className="animate-wave-2 absolute w-8 sm:w-12 h-8 sm:h-12 rounded-full border-6 sm:border-8 border-[#e1aa1e] bg-[#e1aa1e]/20" style={{ boxShadow: '0 0 20px rgba(225,170,30,0.5), inset 0 0 20px rgba(225,170,30,0.5)' }} />
                    <div className="animate-wave-3 absolute w-8 sm:w-12 h-8 sm:h-12 rounded-full border-6 sm:border-8 border-[#e1aa1e] bg-[#e1aa1e]/20" style={{ boxShadow: '0 0 20px rgba(225,170,30,0.5), inset 0 0 20px rgba(225,170,30,0.5)' }} />
                    <div className="animate-wave-4 absolute w-8 sm:w-12 h-8 sm:h-12 rounded-full border-6 sm:border-8 border-[#e1aa1e] bg-[#e1aa1e]/20" style={{ boxShadow: '0 0 20px rgba(225,170,30,0.5), inset 0 0 20px rgba(225,170,30,0.5)' }} />
                    <div className="animate-wave-5 absolute w-8 sm:w-12 h-8 sm:h-12 rounded-full border-6 sm:border-8 border-[#e1aa1e] bg-[#e1aa1e]/20" style={{ boxShadow: '0 0 20px rgba(225,170,30,0.5), inset 0 0 20px rgba(225,170,30,0.5)' }} />
                    <div className="animate-wave-6 absolute w-8 sm:w-12 h-8 sm:h-12 rounded-full border-6 sm:border-8 border-[#e1aa1e] bg-[#e1aa1e]/20" style={{ boxShadow: '0 0 20px rgba(225,170,30,0.5), inset 0 0 20px rgba(225,170,30,0.5)' }} />
                  </div>
                </>
              )}
              {/* Botão de Play */}
              <button
                onClick={() => {
                  if (currentAudio) {
                    togglePlay(currentAudio);
                  }
                }}
                className={`relative z-10 p-2.5 sm:p-4 rounded-full bg-[#e1aa1e] hover:bg-[#e1aa1e]/90 transition-all transform 
                  hover:scale-105 active:scale-95 shadow-lg ${externalIsPlaying ? 'ring-4 ring-[#e1aa1e]/50 animate-glow' : ''}`}
                disabled={!currentAudio}
              >
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8 text-gray-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {externalIsPlaying ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Controles e Progresso */}
        <div className="p-3 sm:p-4 bg-[#1e1e1e]/50">
          <audio
            ref={audioRef}
            src={currentAudio?.url}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleAudioEnd}
            onPlay={() => window.dispatchEvent(new Event('audioPlay'))}
            onPause={() => window.dispatchEvent(new Event('audioStop'))}
            className="hidden"
          />

          {/* Barra de Progresso */}
          <div
            className="h-1.5 bg-[#404040] rounded-full cursor-pointer mb-2"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-[#e1aa1e] rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Tempo */}
          <div className="flex justify-between text-[10px] sm:text-xs text-gray-400 mb-2 sm:mb-3">
            <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
            <span>{formatTime(audioRef.current?.duration || 0)}</span>
          </div>

          {/* Próxima Reprodução */}
          {(() => {
            const nextInfo = getNextAudioInfo();
            if (!nextInfo?.nextAudio) return null;

            return (
              <div className="flex justify-end">
                <div className="text-right bg-[#2d2d2d] px-2 sm:px-3 py-1 rounded border border-[#404040]/50">
                  <div className="text-[10px] sm:text-xs text-gray-400 truncate max-w-[200px] sm:max-w-none">
                    Próximo: {nextInfo.nextAudio.title}
                  </div>
                  {nextInfo.timer && (
                    <div className="text-[10px] sm:text-xs text-[#e1aa1e]">
                      Em {formatTimeLeft(nextInfo.timer.timeLeft)}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Cabeçalho da Lista */}
      <div className="mb-4 bg-[#2d2d2d] rounded-lg p-2 sm:p-2 border border-[#404040] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 px-2">Lista de Áudios</span>
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Botão Falar Texto */}
          <button
            onClick={() => setIsTextToSpeechOpen(true)}
            className={`
              bg-[#2d2d2d] hover:bg-[#404040] text-[#e1aa1e] px-3 sm:px-4 py-1.5 sm:py-2 rounded  
              flex items-center gap-2 transition-all duration-300 
              border border-[#404040] hover:border-[#e1aa1e]
              text-xs sm:text-sm flex-1 sm:flex-none justify-center
              ${isTextToSpeechSpeaking ? 'button-speaking' : ''}
            `}
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-300 ${
                isTextToSpeechSpeaking ? 'icon-speaking' : ''
              }`}
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
            <span className="text-sm flex items-center">
              {isTextToSpeechSpeaking ? (
                <span className="inline-flex items-center gap-2">
                  <span className="whitespace-nowrap">Falando</span>
                  <span className="speaking-dots">
                    <span className="speaking-dot" />
                    <span className="speaking-dot" />
                    <span className="speaking-dot" />
                  </span>
                </span>
              ) : (
                'Falar Texto'
              )}
            </span>
          </button>

          {/* Botão Anexar Áudio */}
          <label className={`
            bg-[#2d2d2d] hover:bg-[#404040] text-[#e1aa1e] px-4 py-2 rounded 
            flex items-center gap-2 transition-all duration-300 
            border border-[#404040] hover:border-[#e1aa1e] cursor-pointer
          `}>
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
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <span className="text-sm">
              {isUploading ? 'Enviando...' : 'Anexar Áudio'}
            </span>
            <input
              type="file"
              className="hidden"
              accept="audio/*"
              onChange={handleUpload}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      {/* Adicionar mensagem de erro após os botões de ação */}
      {uploadError && (
        <div className="mt-4 p-4 bg-gradient-to-r from-red-500/10 via-red-500/5 to-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-red-400 font-medium text-sm mb-1">Arquivo Duplicado</h3>
              <p className="text-red-300/90 text-sm">{uploadError}</p>
            </div>
            <button 
              onClick={() => setUploadError(null)}
              className="p-1 hover:bg-red-500/10 rounded-lg transition-colors text-red-400 hover:text-red-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Lista de Áudios */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        <div className="text-xs text-gray-400 italic mb-2 px-2">
          Clique no ícone de edição ou dê um duplo clique no nome para renomear
        </div>

        {audios
          .sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!b.is_pinned && a.is_pinned) return 1;
            if (a.is_pinned && b.is_pinned) {
              return new Date(b.pinned_at!).getTime() - new Date(a.pinned_at!).getTime();
            }
            return 0;
          })
          .map((audio) => (
            <div
              key={audio.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#2d2d2d] transition-colors min-w-0 bg-[#1e1e1e] mb-2"
            >
              <button
                onClick={(e) => handlePin(e, audio.id)}
                className={`p-1.5 hover:bg-[#404040] rounded transition-colors ${
                  pinnedAudios.includes(audio.id) 
                    ? 'text-[#e1aa1e]' 
                    : 'text-white hover:text-[#e1aa1e]'
                }`}
                title={pinnedAudios.includes(audio.id) ? "Desfixar áudio" : "Fixar áudio"}
              >
                <svg
                  className="w-6 h-6 -rotate-90"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 364 366"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M205.8 264.3c-5.8-6.6-8.4-20.6-5.8-31.3l1.3-5.2-17.9-17.9-17.9-17.9-6.5 2.6c-14.1 5.7-31.3 7-45.6 3.4-10.1-2.5-22.5-8.7-29.3-14.7l-5.3-4.6 22.1-22.1 22.1-22.1-23.5-23.5-23.4-23.4-2.2-9.3c-1.3-5.1-2-9.6-1.6-10 0.4-0.4 4.9 0.3 10 1.6l9.3 2.2 23.4 23.4 23.5 23.5 22.1-22.1 22.1-22.1 4.2 4.9c9.9 11.2 16 26.7 16.8 42.9 0.7 11.9-0.7 20.9-4.8 31.4l-2.9 7.5 17.9 17.9 17.9 17.9 5.2-1.3c7.9-1.9 19.4-0.9 25.6 2.3 9.7 4.9 11.3 2.2-23.2 36.8-17 17-31.2 30.9-31.5 30.9-0.3 0-1.3-0.8-2.1-1.7z"
                  />
                </svg>
              </button>

              <button
                onClick={() => togglePlay(audio)}
                className="p-1 hover:bg-[#404040] rounded-full transition-colors"
              >
                <svg
                  className="w-6 h-6 text-[#e1aa1e]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {externalIsPlaying && currentAudio?.id === audio.id ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  )}
                </svg>
              </button>

              {editingAudioId === audio.id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => {
                    if (editingTitle.trim() && editingTitle !== audio.title) {
                      handleUpdateTitle(audio.id, editingTitle);
                    } else {
                      setEditingAudioId(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editingTitle.trim() && editingTitle !== audio.title) {
                        handleUpdateTitle(audio.id, editingTitle);
                      } else {
                        setEditingAudioId(null);
                      }
                    } else if (e.key === 'Escape') {
                      setEditingAudioId(null);
                    }
                  }}
                  className="flex-1 bg-[#1e1e1e] text-gray-200 px-2 py-1 rounded border border-[#404040] focus:border-[#e1aa1e] focus:outline-none"
                  autoFocus
                />
              ) : (
                <div className="flex-1 flex items-center min-w-0 group">
                  <div className="flex-1 flex items-center min-w-0">
                    <span 
                      className="truncate cursor-pointer hover:text-[#e1aa1e]"
                      onDoubleClick={() => {
                        setEditingAudioId(audio.id);
                        setEditingTitle(audio.title);
                      }}
                    >
                      {audio.title}
                    </span>
                    <div className="flex items-center h-full [&_[data-tooltip]]:relative [&_[data-tooltip]]:before:content-[attr(title)] [&_[data-tooltip]]:before:absolute [&_[data-tooltip]]:before:px-3 [&_[data-tooltip]]:before:py-2 [&_[data-tooltip]]:before:left-1/2 [&_[data-tooltip]]:before:-translate-x-1/2 [&_[data-tooltip]]:before:-top-10 [&_[data-tooltip]]:before:bg-[#2d2d2d]/95 [&_[data-tooltip]]:before:backdrop-blur-sm [&_[data-tooltip]]:before:rounded-lg [&_[data-tooltip]]:before:text-xs [&_[data-tooltip]]:before:font-medium [&_[data-tooltip]]:before:text-[#e1aa1e] [&_[data-tooltip]]:before:whitespace-nowrap [&_[data-tooltip]]:before:opacity-0 [&_[data-tooltip]]:before:scale-95 [&_[data-tooltip]]:before:transition-all [&_[data-tooltip]]:hover:before:opacity-100 [&_[data-tooltip]]:hover:before:scale-100 [&_[data-tooltip]]:before:shadow-lg [&_[data-tooltip]]:before:border [&_[data-tooltip]]:before:border-[#e1aa1e]/10">
                      <button
                        onClick={() => {
                          setEditingAudioId(audio.id);
                          setEditingTitle(audio.title);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity -ml-1 pl-2 flex items-center h-full py-0.5"
                        title="Alterar nome • Editar"
                        data-tooltip="true"
                      >
                        <svg
                          className="w-4 h-4 text-[#e1aa1e]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2 shrink-0">
                {audioTimers[audio.id] ? (
                  <button
                    onClick={(e) => {
                      handleShowConfirmDialog(e, audio.id);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#e1aa1e]/10 text-[#e1aa1e] hover:bg-[#e1aa1e]/20 transition-colors"
                    title="Clique para desativar a repetição"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-sm">
                      {formatTimeLeft(audioTimers[audio.id].timeLeft)}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      handleShowTimerDialog(e, audio.id);
                    }}
                    className="p-1.5 hover:bg-[#404040] rounded transition-colors text-gray-400 hover:text-[#e1aa1e]"
                    title="Ativar repetição automática"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                )}

                <button
                  onClick={(e) => {
                    setDeletePosition({ x: e.currentTarget.getBoundingClientRect().x, y: e.currentTarget.getBoundingClientRect().y + 30 });
                    setShowDeleteConfirm(audio.id);
                  }}
                  className="p-1 hover:bg-[#404040] rounded-full transition-colors text-red-400 hover:text-red-300"
                  title="Excluir áudio"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
      </div>

      {showTimerDialog && (
        <SetTimerDialog
          audioId={showTimerDialog}
          audioTitle={audios.find(a => a.id === showTimerDialog)?.title || ''}
          onConfirm={(minutes) => {
            startRepeatTimer(showTimerDialog, minutes);
            setShowTimerDialog(null);
            setPopupPosition(null);
            setTimerInputValue('');
          }}
          onCancel={() => {
            setShowTimerDialog(null);
            setPopupPosition(null);
            setTimerInputValue('');
          }}
          buttonPosition={popupPosition}
          inputValue={timerInputValue}
          onInputChange={setTimerInputValue}
        />
      )}

      {showConfirmDialog && (
        <ConfirmDialog
          audioId={showConfirmDialog}
          onConfirm={() => {
            stopRepeatTimer(showConfirmDialog);
            setShowConfirmDialog(null);
            setConfirmPosition(null);
          }}
          onEdit={() => {
            setShowConfirmDialog(null);
            setConfirmPosition(null);
            // Abre o diálogo de timer com a posição atual
            setPopupPosition(confirmPosition);
            setShowTimerDialog(showConfirmDialog);
          }}
          onCancel={() => {
            setShowConfirmDialog(null);
            setConfirmPosition(null);
          }}
          buttonPosition={confirmPosition}
        />
      )}

      {showDeleteConfirm && (
        <DeleteConfirmDialog
          audioId={showDeleteConfirm}
          onConfirm={() => {
            handleDelete(showDeleteConfirm);
            setShowDeleteConfirm(null);
            setDeletePosition(null);
          }}
          onCancel={() => {
            setShowDeleteConfirm(null);
            setDeletePosition(null);
          }}
          buttonPosition={deletePosition}
        />
      )}

      {showPinConfirm && (
        <PinConfirmDialog
          audioId={showPinConfirm}
          audioTitle={audios.find(a => a.id === showPinConfirm)?.title || ''}
          onConfirm={() => {
            togglePin(showPinConfirm);
            setShowPinConfirm(null);
            setPinConfirmPosition(null);
          }}
          onCancel={() => {
            setShowPinConfirm(null);
            setPinConfirmPosition(null);
          }}
          buttonPosition={pinConfirmPosition}
          isPinned={pinnedAudios.includes(showPinConfirm)}
        />
      )}

      <TextToSpeech
        isOpen={isTextToSpeechOpen}
        onClose={() => setIsTextToSpeechOpen(false)}
        onPlayingChange={(playing: boolean) => {
          setIsTextToSpeechSpeaking(playing);
          if (playing && audioRef.current && externalIsPlaying) {
            audioRef.current.pause();
            setExternalIsPlaying(false);
          }
        }}
      />

      {showOfflineMessage && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-[#1e1e1e] text-[#e1aa1e] px-4 py-2 rounded-lg border border-[#404040] shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Reprodução indisponível no modo offline</span>
          </div>
        </div>
      )}
    </div>
    
  );
};

export default AudioPlayer; 