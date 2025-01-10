import React, { useState, useEffect, useRef } from 'react';
import { audioService, AudioData } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import '../styles/animations.css';
import TextToSpeech from './TextToSpeech';
import { config } from '../config';

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

const AudioPlayer: React.FC<AudioPlayerProps> = ({ onEnded, isPlaying, setIsPlaying }) => {
  console.log('Env API Key:', process.env.REACT_APP_GOOGLE_API_KEY ? 'Presente' : 'Ausente');

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

  useEffect(() => {
    console.log('Estado do TextToSpeech:', { isOpen: isTextToSpeechOpen, isSpeaking: isTextToSpeechSpeaking });
  }, [isTextToSpeechOpen, isTextToSpeechSpeaking]);

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
      setAudios(data);
      
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
          setIsPlaying(true);

          try {
            await audioRef.current.play();
          } catch (error) {
            isPlayingRef.current = false;
            setIsPlaying(false);
            return;
          }
        }

        // Libera para próxima reprodução quando este áudio terminar
        audioRef.current?.addEventListener('ended', () => {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }, { once: true });

      } catch (error) {
        isPlayingRef.current = false;
        setIsPlaying(false);
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
    if (onEnded) {
      onEnded();
    }
  };

  const togglePlay = (audio: AudioData) => {
    // Se clicou em um áudio diferente do atual
    if (currentAudio?.id !== audio.id) {
      // Para o áudio atual se estiver tocando
      if (audioRef.current) {
        audioRef.current.pause();
        isPlayingRef.current = false;
      }
      // Apenas define o novo áudio
      setCurrentAudio(audio);
      
      // Se não tiver timer ativo, inicia a reprodução manualmente
      if (!audioTimers[audio.id]) {
        if (audioRef.current) {
          audioRef.current.src = audio.url;
          audioRef.current.currentTime = 0;
          
          // Aguarda o áudio estar pronto antes de reproduzir
          audioRef.current.addEventListener('canplay', () => {
            if (!isPlayingRef.current) {
              isPlayingRef.current = true;
              setIsPlaying(true);
              audioRef.current?.play().catch(() => {
                isPlayingRef.current = false;
                setIsPlaying(false);
              });
            }
          }, { once: true });
        }
      }
    } else {
      // Se clicou no mesmo áudio, apenas alterna play/pause
      if (isPlaying) {
        audioRef.current?.pause();
        isPlayingRef.current = false;
        setIsPlaying(false);
      } else {
        if (audioRef.current && !isPlayingRef.current) {
          isPlayingRef.current = true;
          setIsPlaying(true);
          audioRef.current.play().catch(() => {
            isPlayingRef.current = false;
            setIsPlaying(false);
          });
        }
      }
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      console.log('Iniciando upload do arquivo:', file.name);
      
      // Upload do arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `audios/${fileName}`;

      console.log('Tentando fazer upload para:', filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw uploadError;
      }

      console.log('Upload bem sucedido:', uploadData);

      // Obtém a URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      console.log('URL pública gerada:', publicUrl);

      // Adiciona ao banco de dados
      const newAudio = await audioService.addAudio({
        title: file.name,
        url: publicUrl,
        auto_repeat: false,
        repeat_interval: 0,
        play_count: 0
      });

      console.log('Áudio adicionado ao banco:', newAudio);

      // Recarrega todos os áudios
      await loadAudios();
      
      // Seleciona o novo áudio
      setCurrentAudio(newAudio);
      
      // Limpa o input
      event.target.value = '';

    } catch (error) {
      console.error('Erro detalhado no upload:', error);
    } finally {
      setIsUploading(false);
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
      
      console.log(`Timer salvo para ${audioId} com intervalo de ${minutes}min`);
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    }
  };

  const stopRepeatTimer = async (audioId: string) => {
    // Não para o timer se o áudio estiver tocando
    if (currentAudio?.id === audioId && isPlaying) {
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
      
      console.log(`Timer removido para ${audioId}`);
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    }
  };

  const handleDelete = async (audioId: string) => {
    try {
      const audioToDelete = audios.find(a => a.id === audioId);
      if (!audioToDelete) return;

      const fileUrl = audioToDelete.url;
      const fileName = fileUrl.split('/audios/')[1]?.split('?')[0];

      if (fileName) {
        console.log('Tentando remover arquivo:', fileName);

        try {
          // Primeira tentativa de remoção
          const { error: storageError } = await supabase.storage
            .from('media')
            .remove([`audios/${fileName}`]);

          if (storageError) {
            console.error('Erro ao remover arquivo:', storageError);
            
            // Se falhar, espera um momento e tenta novamente
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Segunda tentativa
            await supabase.storage
              .from('media')
              .remove([`audios/${fileName}`]);
          }

          // Verifica se o arquivo ainda existe
          const { data: files } = await supabase.storage
            .from('media')
            .list('audios', {
              search: fileName
            });

          console.log('Verificação após remoção:', files);
        } catch (storageError) {
          console.error('Erro ao acessar storage:', storageError);
        }
      }

      // Remove o registro do banco de dados
      await audioService.deleteAudio(audioId);

      // Atualiza estados locais
      if (currentAudio?.id === audioId) {
        setCurrentAudio(null);
        setIsPlaying(false);
      }

      if (audioTimers[audioId]) {
        await stopRepeatTimer(audioId);
      }

      setPreferences(prev => {
        const newPrefs = { ...prev };
        delete newPrefs[audioId];
        return newPrefs;
      });

      // Força uma atualização da lista de arquivos no storage
      const { data: updatedFiles } = await supabase.storage
        .from('media')
        .list('audios');

      console.log('Lista atualizada de arquivos:', updatedFiles);

      // Recarrega a lista de áudios
      await loadAudios();

      console.log('Áudio removido com sucesso:', audioId);
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
      return `${Math.ceil(seconds)}s`;
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
      await audioService.updateAudio(audioId, { title: newTitle });
      // Atualiza o estado local dos áudios
      setAudios(prev => prev.map(audio => 
        audio.id === audioId ? { ...audio, title: newTitle } : audio
      ));
      // Se o áudio sendo editado é o atual, atualiza também o currentAudio
      if (currentAudio?.id === audioId) {
        setCurrentAudio(prev => prev ? { ...prev, title: newTitle } : null);
      }
      setEditingAudioId(null);
    } catch (error) {
      console.error('Erro ao atualizar título:', error);
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
  }) => (
    <div className="fixed inset-0 z-50" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div 
        className="absolute bg-[#2d2d2d] p-4 rounded-lg border border-[#404040] shadow-lg w-64"
        style={{
          top: buttonPosition ? `${buttonPosition.y - 80}px` : '50%',
          left: buttonPosition ? `${buttonPosition.x - 100}px` : '50%',
          transform: isAnimating ? 'scale(0.9)' : 'scale(1)',
          opacity: isAnimating ? 0 : 1,
          transition: 'transform 0.2s ease-out, opacity 0.2s ease-out'
        }}
      >
        <h3 className="text-[#e1aa1e] font-medium text-sm mb-2">Gerenciar Repetição</h3>
        <p className="text-gray-300 text-xs mb-4">
          Escolha uma das opções para editar a repetição automática:
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded bg-[#404040] text-xs text-gray-200 hover:bg-[#505050] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 rounded bg-[#e1aa1e]/20 text-xs text-[#e1aa1e] hover:bg-[#e1aa1e]/30 transition-colors"
          >
            Editar
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded bg-[#e1aa1e] text-xs text-gray-900 hover:bg-[#e1aa1e]/80 transition-colors"
          >
            Desativar
          </button>
        </div>
      </div>
    </div>
  );

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
    return (
      <div className="fixed inset-0 z-50" onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}>
        <div 
          className="absolute bg-[#2d2d2d] p-4 rounded-lg border border-[#404040] shadow-lg w-64"
          style={{
            top: buttonPosition ? `${buttonPosition.y - 80}px` : '50%',
            left: buttonPosition ? `${buttonPosition.x - 100}px` : '50%',
            transform: isAnimating ? 'scale(0.9)' : 'scale(1)',
            opacity: isAnimating ? 0 : 1,
            transition: 'transform 0.2s ease-out, opacity 0.2s ease-out'
          }}
        >
          <h3 className="text-[#e1aa1e] font-medium text-sm mb-2">Repetir Áudio</h3>
          <p className="text-gray-300 text-xs mb-3 truncate">
            {audioTitle}
          </p>
          
          <div className="relative mb-4">
            <input
              type="number"
              min="1"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="00"
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#404040] rounded text-gray-200 text-center focus:border-[#e1aa1e] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-12"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = parseInt(inputValue);
                  if (value > 0) onConfirm(value);
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
              onClick={onCancel}
              className="px-3 py-1.5 rounded bg-[#404040] text-xs text-gray-200 hover:bg-[#505050] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const value = parseInt(inputValue);
                if (value > 0) onConfirm(value);
              }}
              disabled={!inputValue || parseInt(inputValue) <= 0}
              className="px-3 py-1.5 rounded bg-[#e1aa1e] text-xs text-gray-900 hover:bg-[#e1aa1e]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  }) => (
    <div className="fixed inset-0 z-50" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div 
        className="absolute bg-[#2d2d2d] p-4 rounded-lg border border-[#404040] shadow-lg w-64"
        style={{
          top: buttonPosition ? `${buttonPosition.y - 80}px` : '50%',
          left: buttonPosition ? `${buttonPosition.x - 100}px` : '50%',
          transform: isAnimating ? 'scale(0.9)' : 'scale(1)',
          opacity: isAnimating ? 0 : 1,
          transition: 'transform 0.2s ease-out, opacity 0.2s ease-out'
        }}
      >
        <h3 className="text-red-500 font-medium text-sm mb-2">Confirmar Exclusão</h3>
        <p className="text-gray-300 text-xs mb-4">
          Tem certeza que deseja excluir este áudio?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded bg-[#404040] text-xs text-gray-200 hover:bg-[#505050] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded bg-red-500 text-xs text-white hover:bg-red-600 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (audioRef.current && canvasRef.current) {
      if (isPlaying) {
        audioRef.current.play();
        canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      } else {
        audioRef.current.pause();
        canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [isPlaying]);

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
          const amplitude = isPlaying ? 30 * value : 10;
          
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
        const alpha = isPlaying ? (0.5 - (w - 1) * 0.1) : 0.2;
        
        gradient.addColorStop(0, `rgba(225, 170, 30, 0)`);
        gradient.addColorStop(0.5, `rgba(225, 170, 30, ${alpha})`);
        gradient.addColorStop(1, `rgba(225, 170, 30, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Efeito de brilho
        if (isPlaying) {
          ctx.save();
          ctx.filter = 'blur(4px)';
          ctx.strokeStyle = `rgba(225, 170, 30, ${alpha * 0.5})`;
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Adiciona partículas brilhantes
      if (isPlaying) {
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

  return (
    <div className="bg-[#1e1e1e] text-gray-300 rounded-lg shadow-lg p-4">
      {/* Player Principal com Visualizador */}
      <div className="mb-4 bg-[#2d2d2d] rounded-lg border border-[#404040] overflow-hidden">
        {/* Título do Áudio */}
        <div className="p-3 border-b border-[#404040]">
          <h3 className="text-[#e1aa1e] font-medium text-center">
            {currentAudio?.title || 'Selecione um áudio'}
          </h3>
        </div>

        {/* Área do Visualizador */}
        <div className="relative h-32 bg-[#1e1e1e] p-4">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            width={1000}
            height={200}
          />
          
          {/* Botão de Play centralizado */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => {
                if (currentAudio) {
                  setIsPlaying(!isPlaying);
                  if (isPlaying) {
                    audioRef.current?.pause();
                  } else {
                    audioRef.current?.play();
                  }
                }
              }}
              className={`p-4 rounded-full bg-[#e1aa1e]/90 hover:bg-[#e1aa1e] transition-all transform 
                hover:scale-105 active:scale-95 ${isPlaying ? 'animate-pulse' : ''}`}
              disabled={!currentAudio}
            >
              <svg
                className="w-8 h-8 text-gray-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isPlaying ? (
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

        {/* Controles e Progresso */}
        <div className="p-4 bg-[#1e1e1e]/50">
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
            className="h-1 bg-[#404040] rounded-full cursor-pointer mb-2"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-[#e1aa1e] rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Tempo */}
          <div className="flex justify-between text-xs text-gray-400 mb-3">
            <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
            <span>{formatTime(audioRef.current?.duration || 0)}</span>
          </div>

          {/* Próxima Reprodução */}
          {(() => {
            const nextInfo = getNextAudioInfo();
            if (!nextInfo?.nextAudio) return null;

            return (
              <div className="flex justify-end">
                <div className="text-right bg-[#2d2d2d] px-3 py-1 rounded border border-[#404040]/50">
                  <div className="text-xs text-gray-400">
                    Próximo: {nextInfo.nextAudio.title}
                  </div>
                  {nextInfo.timer && (
                    <div className="text-xs text-[#e1aa1e]">
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
      <div className="mb-3 bg-[#2d2d2d] rounded-lg p-2 border border-[#404040] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 px-2">Lista de Áudios</span>
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-2">
          {/* Botão Falar Texto */}
          <button
            onClick={() => setIsTextToSpeechOpen(true)}
            className={`
              bg-[#2d2d2d] hover:bg-[#404040] text-[#e1aa1e] px-4 py-2 rounded  
              flex items-center gap-2 transition-all duration-300 
              border border-[#404040] hover:border-[#e1aa1e]
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
                d="M12 4v16m8-8H4"
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

      {/* Lista de Áudios */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        <div className="text-xs text-gray-400 italic mb-2 px-2">
          Clique no ícone de edição ou dê um duplo clique no nome para renomear
        </div>

        {audios.map((audio) => (
          <div
            key={audio.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#2d2d2d] transition-colors min-w-0 bg-[#1e1e1e] mb-2"
          >
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
                {isPlaying && currentAudio?.id === audio.id ? (
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
              <div className="flex-1 flex items-center group">
                <div className="flex-1 flex items-center">
                <span 
                    className="truncate cursor-pointer hover:text-[#e1aa1e]"
                  onDoubleClick={() => {
                    setEditingAudioId(audio.id);
                    setEditingTitle(audio.title);
                  }}
                >
                  {audio.title}
                </span>
                <button
                  onClick={() => {
                    setEditingAudioId(audio.id);
                    setEditingTitle(audio.title);
                  }}
                    className="p-1 rounded-full hover:bg-[#404040] opacity-0 group-hover:opacity-100 transition-all ml-1"
                  title="Editar nome"
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
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
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
                      className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
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

      <TextToSpeech
        apiKey={config.googleApiKey}
        isOpen={isTextToSpeechOpen}
        onClose={() => {
          console.log('Fechando TextToSpeech'); // Debug
          setIsTextToSpeechOpen(false);
        }}
        onPlayingChange={(playing) => {
          console.log('TextToSpeech playing changed:', playing); // Debug
          setIsTextToSpeechSpeaking(playing);
          if (playing && audioRef.current && isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        }}
      />
    </div>
    
  );
};

export default AudioPlayer; 