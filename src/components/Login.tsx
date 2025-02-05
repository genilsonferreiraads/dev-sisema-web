import React, { useState, useEffect } from 'react';
import { authService } from '../lib/auth';
import logo from '../assets/Logo Site Império.png';
import backgroundImg from '../assets/background-login.png';

interface LoginProps {
  onLoginSuccess: () => void;
}

// Funções auxiliares para manipular cookies
const setCookie = (name: string, value: string, days: number) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict${window.location.protocol === 'https:' ? ';Secure' : ''}`;
};

const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeLeft, setBlockTimeLeft] = useState(0);

  useEffect(() => {
    // Verificar tentativas de login armazenadas
    const storedAttempts = getCookie('loginAttempts');
    if (storedAttempts) {
      setLoginAttempts(parseInt(storedAttempts));
    }

    // Verificar se está bloqueado
    const blockedUntil = getCookie('loginBlockedUntil');
    if (blockedUntil) {
      const blockTime = new Date(blockedUntil).getTime();
      const now = new Date().getTime();
      
      if (blockTime > now) {
        setIsBlocked(true);
        startBlockTimer(blockTime);
      } else {
        deleteCookie('loginBlockedUntil');
        deleteCookie('loginAttempts');
        resetLoginAttempts();
      }
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (error?.includes('conexão com a internet')) {
        setError(null);
      }
    };

    const handleOffline = () => {
      setError('Não foi possível conectar ao servidor. Por favor, verifique sua conexão com a internet.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error]);

  const startBlockTimer = (blockTime: number) => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const timeLeft = Math.ceil((blockTime - now) / 1000);
      
      if (timeLeft <= 0) {
        clearInterval(interval);
        setIsBlocked(false);
        setBlockTimeLeft(0);
        deleteCookie('loginBlockedUntil');
        resetLoginAttempts();
      } else {
        setBlockTimeLeft(timeLeft);
      }
    }, 1000);
  };

  const resetLoginAttempts = () => {
    setLoginAttempts(0);
    deleteCookie('loginAttempts');
    deleteCookie('loginBlockedUntil');
    setIsBlocked(false);
    setBlockTimeLeft(0);
  };

  const handleFailedLogin = () => {
    const attempts = loginAttempts + 1;
    setLoginAttempts(attempts);
    
    // Define o cookie para expirar em 24 horas
    setCookie('loginAttempts', attempts.toString(), 1);

    if (attempts >= 5) {
      const blockTime = new Date().getTime() + (5 * 60 * 1000); // 5 minutos
      const blockUntil = new Date(blockTime).toISOString();
      
      // Define o cookie de bloqueio
      setCookie('loginBlockedUntil', blockUntil, 1);
      
      setIsBlocked(true);
      startBlockTimer(blockTime);
      setError('Muitas tentativas. Tente novamente em 5 minutos.');
    } else {
      setError(`Usuário ou senha inválidos. Tentativas restantes: ${5 - attempts}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (isBlocked) {
      setError(`Aguarde ${blockTimeLeft} segundos para tentar novamente`);
      return;
    }

    if (!trimmedUsername || !trimmedPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    if (trimmedPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);
      const user = await authService.signIn(trimmedUsername, trimmedPassword);
      if (user) {
        resetLoginAttempts();
        onLoginSuccess();
      } else {
        handleFailedLogin();
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || 
            err.message.includes('Network Error') || 
            !navigator.onLine) {
          setError('Não foi possível conectar ao servidor. Por favor, verifique sua conexão com a internet.');
        } else {
          handleFailedLogin();
        }
      } else {
        handleFailedLogin();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      window.dispatchEvent(new Event('audioStop'));
      window.dispatchEvent(new Event('videoStop'));
      await new Promise(resolve => setTimeout(resolve, 100));
      await authService.signOut();
      window.location.reload();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative bg-[#1e1e1e] overflow-hidden"
    >
      {/* Background com animação e mesclagem aprimorada */}
      <div 
        className="absolute inset-0 animate-kenburns"
        style={{
          backgroundImage: `url(${backgroundImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: 'scale(1.1)'
        }}
      >
        {/* Camadas de mesclagem com múltiplos gradientes */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#e1aa1e]/10 via-transparent to-[#1e1e1e]/30"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e]/40 via-transparent to-[#e1aa1e]/5"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1e1e1e]/20 via-transparent to-[#e1aa1e]/5"></div>
        
        {/* Camada de vinheta */}
        <div className="absolute inset-0 bg-radial-dark opacity-50"></div>
        
        {/* Camada de brilho animado */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#e1aa1e]/5 via-transparent to-[#e1aa1e]/5 animate-pulse"></div>
      </div>

      {/* Overlay principal com gradiente mais suave */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1e1e1e]/60 via-[#1e1e1e]/50 to-[#1e1e1e]/70">
        {/* Camada extra de textura */}
        <div className="absolute inset-0 opacity-10 mix-blend-overlay bg-texture"></div>
      </div>

      {/* Login form with animated border */}
      <div className="relative group">
        {/* Animated border container */}
        <div className="absolute -inset-[3px] rounded-lg overflow-hidden">
          {/* Animated gradient border */}
          <div 
            className="absolute inset-0 animate-border-flow"
            style={{
              background: 'linear-gradient(90deg, transparent, #e1aa1e 25%, #ffd700 50%, #e1aa1e 75%, transparent), linear-gradient(0deg, transparent, #e1aa1e 25%, #ffd700 50%, #e1aa1e 75%, transparent)',
              backgroundSize: '400% 400%',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude',
              padding: '3px',
            }}
          >
          </div>
          
          {/* Glowing corners */}
          <div className="absolute top-0 left-0 w-5 h-5">
            <div className="absolute inset-0 bg-[#e1aa1e] rounded-full blur-[4px] animate-corner-pulse opacity-70"></div>
          </div>
          <div className="absolute top-0 right-0 w-5 h-5">
            <div className="absolute inset-0 bg-[#e1aa1e] rounded-full blur-[4px] animate-corner-pulse opacity-70"></div>
          </div>
          <div className="absolute bottom-0 left-0 w-5 h-5">
            <div className="absolute inset-0 bg-[#e1aa1e] rounded-full blur-[4px] animate-corner-pulse opacity-70"></div>
          </div>
          <div className="absolute bottom-0 right-0 w-5 h-5">
            <div className="absolute inset-0 bg-[#e1aa1e] rounded-full blur-[4px] animate-corner-pulse opacity-70"></div>
          </div>
        </div>

        {/* Container content with glass effect */}
        <div className={`relative bg-[#2d2d2d] p-8 rounded-lg shadow-lg w-96 z-10 ${isExiting ? 'login-exit' : 'login-enter'}`}>
          <div className="text-center mb-8 animate-slideDown">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#1e1e1e] flex items-center justify-center overflow-hidden 
                          border border-[#404040]">
              <img 
                src={logo} 
                alt="Império Fitness Logo" 
                className="w-16 h-16 object-contain hover:scale-110 transition-transform duration-300 cursor-pointer"
              />
            </div>
            <h2 className="text-2xl font-bold text-[#e1aa1e]">Império Fitness</h2>
            <p className="text-gray-400 text-sm mt-1">Área Restrita</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg animate-shake">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input fields with glowing effect on focus */}
            <div className="relative">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="relative w-full pl-10 pr-4 py-3 bg-[#1e1e1e] border border-[#404040] rounded-lg text-gray-300 
                            focus:outline-none focus:border-[#e1aa1e] transition-all placeholder-gray-500"
                  placeholder="Usuário"
                  disabled={isBlocked || loading}
                  required
                />
              </div>
            </div>

            <div className="relative">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="relative w-full pl-10 pr-12 py-3 bg-[#1e1e1e] border border-[#404040] rounded-lg text-gray-300 
                            focus:outline-none focus:border-[#e1aa1e] transition-all placeholder-gray-500"
                  placeholder="Senha"
                  disabled={isBlocked || loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isBlocked || loading}
              className={`w-full py-3 rounded-lg font-medium transition-all duration-200
                ${isBlocked || loading 
                  ? 'bg-[#404040] text-gray-500 cursor-not-allowed' 
                  : 'bg-[#e1aa1e] text-gray-900 hover:bg-[#e1aa1e]/90 active:scale-[0.98]'}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </div>
              ) : isBlocked ? (
                `Bloqueado (${blockTimeLeft}s)`
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login; 