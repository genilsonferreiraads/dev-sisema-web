import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { TTS_API_KEYS, BASE_URL } from '../config/api';
import { temporaryAudioService } from '../services/temporaryAudio';
import { QRCodeCanvas } from 'qrcode.react';

interface TextToSpeechProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayingChange: (isPlaying: boolean) => void;
}

const TextToSpeech: React.FC<TextToSpeechProps> = ({ 
  isOpen, 
  onClose, 
  onPlayingChange
}) => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<'azure' | 'google' | 'elevenlabs'>('azure');
  const [isTypingAnimation, setIsTypingAnimation] = useState(false);
  const [typingIndex, setTypingIndex] = useState(0);
  const [optimizedText, setOptimizedText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedText, setLastGeneratedText] = useState<string>('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isProcessingText, setIsProcessingText] = useState(false);
  const [isOptimizingText, setIsOptimizingText] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [speechText, setSpeechText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(isOpen);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const notifyAudioStart = () => {
    setIsAudioPlaying(true);
    onPlayingChange(true);
    window.dispatchEvent(new Event('audioPlay'));
  };

  const notifyAudioEnd = () => {
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

  const processTextWithGemini = async (inputText: string): Promise<string> => {
    try {
      setIsProcessingText(true);
      const geminiKey = TTS_API_KEYS.gemini;
      
      if (!geminiKey || geminiKey.trim() === '') {
        throw new Error('Chave da API do Gemini não configurada corretamente');
      }

      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const isInstagramRelated = inputText.toLowerCase().includes('instagram') || 
                                inputText.toLowerCase().includes('insta') || 
                                inputText.toLowerCase().includes('@');

      const prompt = `CONTEXTO DE ATUAÇÃO:
Você é um assistente especializado em ajudar a recepcionista da academia Império Fitness a melhorar os textos dos avisos que serão transmitidos no sistema de som da academia.

SEU PAPEL:
1. Melhorar a clareza e gramática dos textos
2. Manter o texto conciso e profissional
3. NUNCA alterar o significado original do texto da recepcionista
4. Auxiliar na formatação adequada para sistema de som
5. Manter o tom adequado para ambiente de academia

TIPOS DE AVISOS COMUNS:
1. Chamadas à recepção:
   - Chamar alguém para comparecer à recepção
   - Avisar que alguém está procurando por outra pessoa
   - Informar sobre objetos esquecidos/perdidos

2. Avisos gerais:
   - Promoções de produtos da academia
   - Informações sobre aulas e horários
   - Comunicados importantes
   - Avisos sobre funcionamento

TEXTO A SER MELHORADO:
"${inputText}"

REGRAS FUNDAMENTAIS:
1. NUNCA adicione informações que não existem no texto original
2. NUNCA altere o local mencionado no texto original
3. NUNCA mencione a recepção se ela não foi citada no texto original
4. Use APENAS os nomes que aparecem no texto original
5. Se nenhum local for mencionado, NÃO ADICIONE um local
6. Se nenhum nome for mencionado, NÃO ADICIONE nomes
7. Mantenha o tom profissional mas natural, evitando formalidade excessiva
8. Preserve SEMPRE o significado original do texto da recepcionista

DIRETRIZES PARA CHAMADAS À RECEPÇÃO:
1. Sempre comece com "Atenção"
2. Use variações naturais para solicitar a presença:
   - "compareça"
   - "dirija-se"
   - "venha"
   - "apresente-se"
   - "aguardamos você"
3. Mantenha um tom cordial usando:
   - "por favor"
   - "por gentileza"
   - "se possível"
4. Evite repetir sempre o mesmo padrão de frase
5. Se houver urgência no texto original, mantenha-a usando termos como:
   - "assim que possível"
   - "com urgência"
   - "imediatamente"
6. Mantenha a ordem: Atenção > Nome > Solicitação > Local

DIRETRIZES PARA OBJETOS PERDIDOS/ESQUECIDOS:
1. Seja específico mas discreto sobre o objeto
2. Mantenha a privacidade do aluno
3. Use frases como:
   - "retirar seu pertence"
   - "buscar seu item"
   - "recuperar seu objeto"

DIRETRIZES PARA PROMOÇÕES E ANÚNCIOS:
1. Mantenha valores e percentuais exatos como mencionados
2. Preserve datas e prazos conforme informado
3. Enfatize benefícios mantendo as informações originais
4. Mantenha condições e restrições como especificadas
5. Use o nome "Império Fitness" quando mencionado no original

DIRETRIZES PARA INSTAGRAM:
Se o texto mencionar Instagram ou tiver @:
1. Para exibição: Use "@imperiofitness.pe"
2. Para fala: Use "arroba império fitness ponto pê é"
3. Separe os formatos com "|||||"

DIRETRIZES DE FORMATAÇÃO:
1. Mantenha o texto conciso e objetivo
2. Use pontuação adequada para pausas naturais
3. Use linguagem formal mas acessível
4. Mantenha a ordem das informações como no texto original

IMPORTANTE: 
1. Retorne apenas o texto melhorado, sem explicações adicionais
2. Mantenha-se fiel ao significado original do texto da recepcionista
3. Priorize clareza e objetividade`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const processedText = response.text().trim();
      
      if (isInstagramRelated) {
        if (!processedText.includes('|||||')) {
          const displayVersion = processedText.replace(/arroba império fitness ponto pê é/gi, '@imperiofitness.pe...');
          const speechVersion = processedText.replace(/@imperiofitness\.pe\.\.\./gi, 'arroba império fitness ponto pê é');
          return `${displayVersion}|||||${speechVersion}`;
        }
      }

      return processedText;
    } catch (error) {
      console.error('Erro ao processar texto com Gemini:', error);
      if (error instanceof Error) {
        setError(`Falha ao otimizar o texto: ${error.message}`);
      } else {
        setError('Falha ao otimizar o texto. Usando texto original.');
      }
      return inputText;
    } finally {
      setIsProcessingText(false);
    }
  };

  const disclaimers = [
    "Este texto foi otimizado por IA. Por favor, verifique se o conteúdo mantém o significado original e faça ajustes se necessário antes de gerar o áudio.",
    "Texto aprimorado por IA. Recomendamos uma rápida revisão para garantir que a mensagem original foi preservada antes de prosseguir.",
    "Conteúdo refinado por IA. Dê uma olhada para confirmar se a essência da mensagem está mantida antes de criar o áudio.",
    "Texto processado por IA. Sugerimos uma breve verificação para assegurar que o sentido original está preservado antes de continuar.",
    "Mensagem aperfeiçoada por IA. Por favor, confira se o significado principal foi mantido antes de gerar o áudio."
  ];

  const [currentDisclaimer, setCurrentDisclaimer] = useState(disclaimers[0]);
  const [lastDisclaimerIndex, setLastDisclaimerIndex] = useState(0);

  // Função para selecionar um novo disclaimer diferente do anterior
  const selectNewDisclaimer = () => {
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * disclaimers.length);
    } while (newIndex === lastDisclaimerIndex);
    
    setLastDisclaimerIndex(newIndex);
    setCurrentDisclaimer(disclaimers[newIndex]);
  };

  const optimizeText = async () => {
    if (!text.trim()) {
      setText('');
      setError('Por favor, digite algum texto para que eu possa ajudar a melhorá-lo.');
      setOptimizedText('');
      return;
    }

    setIsOptimizingText(true);
    setError(null);
    setIsEditing(false);

    try {
      const optimizedResult = await processTextWithGemini(text);
      
      // Seleciona um novo disclaimer diferente do anterior
      selectNewDisclaimer();
      
      // Atualiza o texto otimizado
      setOptimizedText(optimizedResult);
      
      // Se for relacionado ao Instagram, trata os formatos especiais
      if (text.toLowerCase().includes('instagram') || 
          text.toLowerCase().includes('insta') || 
          text.toLowerCase().includes('@')) {
        const [display, speech] = optimizedResult.split('|||||');
        setDisplayText(display.trim());
        setSpeechText(speech ? speech.trim() : display.trim());
      } else {
        setDisplayText(optimizedResult);
        setSpeechText(optimizedResult);
      }

      // Limpa o texto atual e inicia a animação
      setText('');
      setIsTypingAnimation(true);
      setTypingIndex(0);
    } catch (err) {
      console.error('Erro ao otimizar texto:', err);
      setError(err instanceof Error ? err.message : 'Erro ao otimizar texto. Tente novamente.');
    } finally {
      setIsOptimizingText(false);
    }
  };

  const generateSpeech = async () => {
    if (!text.trim()) {
      setText('');
      setError('Por favor, digite algum texto para que eu possa ajudar a melhorá-lo.');
      setOptimizedText('');
      return;
    }

    const textToSpeak = speechText || text;

    if (textToSpeak === lastGeneratedText && audioUrl) {
      playExistingAudio();
      return;
    }

    setIsLoading(true);
    setError(null);

    // Array com a ordem das vozes para tentar
    const voiceOrder = ['azure', 'google', 'elevenlabs'] as const;
    // Reorganiza o array para começar com a voz selecionada
    const orderedVoices = [
      selectedVoice,
      ...voiceOrder.filter(voice => voice !== selectedVoice)
    ];

    let success = false;
    let lastError = null;

    for (const voice of orderedVoices) {
      try {
        let audioBlob;

        if (voice === 'google') {
          if (!TTS_API_KEYS.google) {
            throw new Error('Chave da API do Google não configurada');
          }

          const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEYS.google}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                input: { text: textToSpeak },
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
            throw new Error(errorData?.error?.message || 'Erro ao gerar áudio com Google TTS');
          }

          const { audioContent } = await response.json();
          if (!audioContent) {
            throw new Error('Resposta da API do Google não contém dados de áudio');
          }

          audioBlob = new Blob(
            [Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))],
            { type: 'audio/mp3' }
          );
        } else if (voice === 'elevenlabs') {
          if (!TTS_API_KEYS.elevenlabs) {
            throw new Error('Chave da API do ElevenLabs não configurada');
          }

          const response = await fetch(
            'https://api.elevenlabs.io/v1/text-to-speech/ThT5KcBeYPX3keUQqHPh',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'xi-api-key': TTS_API_KEYS.elevenlabs,
              },
              body: JSON.stringify({
                text: textToSpeak,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75,
                  style: 0.0,
                  use_speaker_boost: true
                }
              }),
            }
          );

          if (!response.ok) {
            throw new Error('Erro ao gerar áudio com ElevenLabs');
          }

          audioBlob = await response.blob();
        } else {
          if (!TTS_API_KEYS.azure) {
            throw new Error('Chave da API da Azure não configurada');
          }

          const response = await fetch(
            'https://brazilsouth.tts.speech.microsoft.com/cognitiveservices/v1',
            {
              method: 'POST',
              headers: {
                'Ocp-Apim-Subscription-Key': TTS_API_KEYS.azure,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
              },
              body: `<speak version='1.0' xml:lang='pt-BR'>
                <voice xml:lang='pt-BR' xml:gender='Female' name='pt-BR-FranciscaNeural'>
                  ${textToSpeak}
                </voice>
              </speak>`
            }
          );

          if (!response.ok) {
            throw new Error('Erro ao gerar áudio com Azure');
          }

          audioBlob = await response.blob();
        }
        
        const url = URL.createObjectURL(audioBlob);
        
        setAudioUrl(url);
        setLastGeneratedText(textToSpeak);
        setSelectedVoice(voice); // Atualiza a voz selecionada para a que funcionou

        await setupAudioElement(url);
        if (audioRef.current) {
          await audioRef.current.play();
          notifyAudioStart();
        }

        success = true;
        break; // Se chegou aqui, deu certo, então podemos parar
      } catch (err) {
        console.error(`Erro ao gerar áudio com ${voice}:`, err);
        lastError = err;
        // Continua para a próxima voz se houver falha
      }
    }

    if (!success) {
      console.error('Todas as tentativas de gerar áudio falharam');
      setError(lastError instanceof Error ? lastError.message : 'Erro ao gerar áudio. Tente novamente.');
      setLastGeneratedText('');
      setAudioUrl(null);
      notifyAudioEnd();
    }

    setIsLoading(false);
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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsModalOpen(false);
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

    // Cleanup quando o componente for desmontado
    return () => {
      if (audioRef.current) {
        const audio = audioRef.current;
        audio.removeEventListener('play', notifyAudioStart);
        audio.removeEventListener('ended', notifyAudioEnd);
        audio.removeEventListener('pause', notifyAudioEnd);
        
        // Só remove o elemento se não estiver tocando
        if (!isAudioPlaying) {
          audio.pause();
          audio.currentTime = 0;
          document.body.removeChild(audio);
          audioRef.current = null;
        }
      }
    };
  }, []);

  useEffect(() => {
    if (audioUrl) {
      return () => {
        URL.revokeObjectURL(audioUrl);
      };
    }
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
    if (isTypingAnimation && typingIndex < displayText.length) {
      const timer = setTimeout(() => {
        setText(displayText.slice(0, typingIndex + 1));
        setTypingIndex(prev => prev + 1);
      }, 30);
      return () => clearTimeout(timer);
    } else if (isTypingAnimation && typingIndex >= displayText.length) {
      setIsTypingAnimation(false);
      setTypingIndex(0);
      setText(displayText); // Garante que o texto completo seja exibido
    }
  }, [isTypingAnimation, typingIndex, displayText]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setError(null);
    if (optimizedText) {
      setIsEditing(true);
      setSpeechText(e.target.value); // Atualiza o speechText com o novo texto editado
      setDisplayText(e.target.value); // Atualiza também o displayText para manter sincronizado
    }
  };

  useEffect(() => {
    setIsModalOpen(isOpen);
  }, [isOpen]);

  // Função para obter a URL base com a porta correta
  const getCurrentBaseUrl = () => {
    const { protocol, hostname, port } = window.location;
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  };

  const generatePreview = async () => {
    if (!text.trim()) {
      setText('');
      setError('Por favor, digite algum texto para que eu possa ajudar a melhorá-lo.');
      return;
    }

    setIsGeneratingPreview(true);
    setError(null);

    try {
      const textToSpeak = speechText || text;
      let audioBlob;

      // Usar a voz selecionada para gerar o áudio
      if (selectedVoice === 'google') {
        if (!TTS_API_KEYS.google) {
          throw new Error('Chave da API do Google não configurada');
        }

        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEYS.google}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: { text: textToSpeak },
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
          throw new Error('Erro ao gerar áudio com Google TTS');
        }

        const { audioContent } = await response.json();
        audioBlob = new Blob(
          [Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))],
          { type: 'audio/mp3' }
        );
      } else if (selectedVoice === 'elevenlabs') {
        if (!TTS_API_KEYS.elevenlabs) {
          throw new Error('Chave da API do ElevenLabs não configurada');
        }

        const response = await fetch(
          'https://api.elevenlabs.io/v1/text-to-speech/ThT5KcBeYPX3keUQqHPh',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': TTS_API_KEYS.elevenlabs,
            },
            body: JSON.stringify({
              text: textToSpeak,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.0,
                use_speaker_boost: true
              }
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Erro ao gerar áudio com ElevenLabs');
        }

        audioBlob = await response.blob();
      } else {
        // Azure (default)
        if (!TTS_API_KEYS.azure) {
          throw new Error('Chave da API da Azure não configurada');
        }

        const response = await fetch(
          'https://brazilsouth.tts.speech.microsoft.com/cognitiveservices/v1',
          {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': TTS_API_KEYS.azure,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
            },
            body: `<speak version='1.0' xml:lang='pt-BR'>
              <voice xml:lang='pt-BR' xml:gender='Female' name='pt-BR-FranciscaNeural'>
                ${textToSpeak}
              </voice>
            </speak>`
          }
        );

        if (!response.ok) {
          throw new Error('Erro ao gerar áudio com Azure');
        }

        audioBlob = await response.blob();
      }

      // Upload do áudio temporário
      const audioUrl = await temporaryAudioService.uploadAudio(audioBlob);
      const baseUrl = getCurrentBaseUrl();
      const previewUrl = `${baseUrl}/audios`;
      setPreviewUrl(previewUrl);
      setShowPreviewModal(true);
    } catch (err) {
      console.error('Erro ao gerar pré-visualização:', err);
      setError(err instanceof Error ? err.message : 'Erro ao gerar pré-visualização. Tente novamente.');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  if (!isModalOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
      >
        <div 
          className="max-w-2xl w-full mx-4 animate-modalExpand"
        >
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
                className="text-gray-400 hover:text-[#e1aa1e] transition-all duration-300 hover:rotate-90 p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Seletor de Voz */}
              <div className="flex items-center gap-4 pb-2">
                <span className="text-sm text-gray-400">Selecione a voz:</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedVoice('azure');
                      setLastGeneratedText('');
                      setAudioUrl(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all duration-300 text-sm ${
                      selectedVoice === 'azure'
                        ? 'bg-[#e1aa1e] text-gray-900 font-medium'
                        : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#404040]'
                    }`}
                  >
                    Azure
                  </button>
                  <button
                    onClick={() => {
                      setSelectedVoice('google');
                      setLastGeneratedText('');
                        setAudioUrl(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all duration-300 text-sm ${
                      selectedVoice === 'google'
                        ? 'bg-[#e1aa1e] text-gray-900 font-medium'
                        : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#404040]'
                    }`}
                  >
                    Google
                  </button>
                  <button
                    onClick={() => {
                      setSelectedVoice('elevenlabs');
                      setLastGeneratedText('');
                        setAudioUrl(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all duration-300 text-sm ${
                      selectedVoice === 'elevenlabs'
                        ? 'bg-[#e1aa1e] text-gray-900 font-medium'
                        : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#404040]'
                    }`}
                  >
                    ElevenLabs
                  </button>
                </div>
              </div>

              <div className="relative group">
                {optimizedText && (
                  <div className="absolute -top-2.5 left-3 z-10 animate-fadeInScale">
                    <span className="px-1.5 py-0.5 text-[10px] bg-[#1e1e1e] text-[#e1aa1e] border border-[#e1aa1e]/20 rounded-full shadow-sm flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isEditing ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        )}
                      </svg>
                      {isEditing ? 'Editando' : 'Texto otimizado por IA'}
                    </span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={handleTextChange}
                      onBlur={(e) => e.stopPropagation()}
                      placeholder="Digite aqui o texto que você quer que seja falado..."
                      className="w-full h-32 bg-[#2d2d2d] border border-[#404040] text-gray-200 rounded-lg px-4 py-3 focus:border-[#e1aa1e] focus:outline-none resize-none transition-all duration-300 focus:shadow-[0_0_10px_rgba(225,170,30,0.3)] group-hover:border-[#e1aa1e]/50 pr-10"
                      disabled={isLoading || isProcessingText || isTypingAnimation}
                    />
                    
                    {/* Ícone Otimizar com IA */}
                    <div 
                      onClick={() => {
                        if (!text.trim()) {
                          setError('Por favor, digite algum texto para que eu possa ajudar a melhorá-lo.');
                          return;
                        }
                        optimizeText();
                      }}
                      className={`
                        absolute right-2 top-2 p-2 rounded-md cursor-pointer
                        hover:bg-[#404040]/50 transition-all duration-300
                        ${isOptimizingText || isTypingAnimation ? 'opacity-50 cursor-not-allowed' : ''}
                        group/optimize
                      `}
                      title="Otimizar com IA"
                    >
                      {isOptimizingText ? (
                        <svg className="animate-spin h-5 w-5 text-[#e1aa1e]" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-[#e1aa1e] transition-transform duration-300 group-hover/optimize:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Mensagem de erro */}
                  {error && (
                    <div className="text-sm text-[#e1aa1e] bg-[#e1aa1e]/10 px-3 py-2 rounded-md border border-[#e1aa1e]/20 flex items-center gap-2 animate-fadeInScale">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Disclaimer de IA */}
              {optimizedText && (
                <div className="bg-[#2d2d2d]/50 border border-[#e1aa1e]/20 rounded-lg p-3 mt-2">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-[#e1aa1e] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-gray-400">
                      <span className="text-[#e1aa1e] font-medium">Importante:</span> {currentDisclaimer}
                    </p>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex items-center gap-3 pt-2">
                {/* Botão Falar Texto */}
                <button
                  onClick={() => {
                    if (!text.trim()) {
                      setError('Por favor, digite algum texto para que eu possa ajudar a melhorá-lo.');
                      return;
                    }
                    isAudioPlaying ? handlePause() : generateSpeech();
                  }}
                  disabled={isLoading || isProcessingText || isTypingAnimation}
                  className={`
                    flex-1 relative overflow-hidden group cursor-pointer ${
                      isLoading || isProcessingText || isTypingAnimation
                        ? 'bg-[#e1aa1e]/50 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-[#e1aa1e] to-[#f5d485] hover:from-[#f5d485] hover:to-[#e1aa1e]'
                    } text-gray-900 px-3 py-2 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 font-medium whitespace-nowrap shadow-lg hover:shadow-[0_0_15px_rgba(225,170,30,0.4)]`}
                >
                  {isAudioPlaying ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

                {/* Botão Pré-visualizar */}
                <button
                  onClick={generatePreview}
                  disabled={isLoading || isProcessingText || isTypingAnimation || isGeneratingPreview}
                  className={`
                    px-4 py-2 rounded-lg transition-all duration-300 cursor-pointer
                    ${isGeneratingPreview
                      ? 'bg-[#e1aa1e]/50 cursor-not-allowed' 
                      : 'bg-[#2d2d2d] hover:bg-[#404040] border border-[#404040] hover:border-[#e1aa1e] text-[#e1aa1e]'}
                    flex items-center gap-2 whitespace-nowrap
                  `}
                >
                  {isGeneratingPreview ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Gerando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <span>Pré-visualizar</span>
                    </>
                  )}
                </button>

                {/* Botão Download (apenas ícone) */}
                {audioUrl && (
                  <button
                    onClick={handleDownload}
                    className="bg-[#2d2d2d] hover:bg-[#404040] border border-[#404040] text-[#e1aa1e] p-2.5 rounded-lg flex items-center justify-center transition-all duration-300 hover:border-[#e1aa1e] hover:text-[#f5d485] hover:shadow-[0_0_10px_rgba(225,170,30,0.2)] group"
                  >
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pré-visualização */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-fadeIn">
          <div className="bg-[#1e1e1e] p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-[#e1aa1e]">
                Pré-visualização Mobile
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-[#e1aa1e] transition-all duration-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="text-center mb-6">
              <p className="text-gray-300 mb-4">
                Escaneie o QR Code abaixo para ouvir o áudio no seu dispositivo móvel
              </p>
              <div className="bg-white p-4 rounded-lg inline-block">
                <QRCodeCanvas
                  value={previewUrl || getCurrentBaseUrl() + '/audios'}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-sm text-gray-400 mt-4">
                O áudio estará disponível por 5 minutos
              </p>
            </div>

            <div className="text-center">
              <a
                href={previewUrl || getCurrentBaseUrl() + '/audios'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#e1aa1e] hover:text-[#f5d485] transition-colors duration-300"
              >
                Abrir no navegador →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TextToSpeech; 