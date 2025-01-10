import React, { useState, useEffect } from 'react';
import { authService } from '../lib/auth';
import logo from '../assets/Logo Site Império.png';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeLeft, setBlockTimeLeft] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const blockedUntil = localStorage.getItem('loginBlockedUntil');
    if (blockedUntil) {
      const blockTime = new Date(blockedUntil).getTime();
      const now = new Date().getTime();
      
      if (blockTime > now) {
        setIsBlocked(true);
        startBlockTimer(blockTime);
      } else {
        localStorage.removeItem('loginBlockedUntil');
        resetLoginAttempts();
      }
    }
  }, []);

  const startBlockTimer = (blockTime: number) => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const timeLeft = Math.ceil((blockTime - now) / 1000);
      
      if (timeLeft <= 0) {
        clearInterval(interval);
        setIsBlocked(false);
        setBlockTimeLeft(0);
        localStorage.removeItem('loginBlockedUntil');
        resetLoginAttempts();
      } else {
        setBlockTimeLeft(timeLeft);
      }
    }, 1000);
  };

  const resetLoginAttempts = () => {
    setLoginAttempts(0);
    localStorage.removeItem('loginAttempts');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isBlocked) {
      setError(`Aguarde ${blockTimeLeft} segundos para tentar novamente`);
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);
      const user = await authService.signIn(username, password);
      if (user) {
        resetLoginAttempts();
        onLoginSuccess();
      } else {
        handleFailedLogin();
      }
    } catch (err) {
      handleFailedLogin();
    } finally {
      setLoading(false);
    }
  };

  const handleFailedLogin = () => {
    const attempts = loginAttempts + 1;
    setLoginAttempts(attempts);
    localStorage.setItem('loginAttempts', attempts.toString());

    if (attempts >= 5) {
      const blockTime = new Date().getTime() + (5 * 60 * 1000);
      localStorage.setItem('loginBlockedUntil', new Date(blockTime).toISOString());
      setIsBlocked(true);
      startBlockTimer(blockTime);
      setError('Muitas tentativas. Tente novamente em 5 minutos.');
    } else {
      setError(`Usuário ou senha inválidos. Tentativas restantes: ${5 - attempts}`);
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
    <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e]">
      <div className={`bg-[#2d2d2d] p-8 rounded-lg shadow-lg w-96 border border-[#404040] ${isExiting ? 'login-exit' : 'login-enter'}`}>
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
              className="w-full pl-10 pr-4 py-3 bg-[#1e1e1e] border border-[#404040] rounded-lg text-gray-300 
                        focus:outline-none focus:border-[#e1aa1e] focus:ring-1 focus:ring-[#e1aa1e] 
                        transition-all placeholder-gray-500"
              placeholder="Usuário"
              disabled={isBlocked || loading}
              required
            />
          </div>

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
              className="w-full pl-10 pr-12 py-3 bg-[#1e1e1e] border border-[#404040] rounded-lg text-gray-300 
                        focus:outline-none focus:border-[#e1aa1e] focus:ring-1 focus:ring-[#e1aa1e] 
                        transition-all placeholder-gray-500"
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
  );
};

export default Login; 