import React, { useState } from 'react';
import { User } from '../types/auth';
import { authService } from '../lib/auth';
import UserSettings from './UserSettings';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onUserUpdate: () => Promise<void>;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onUserUpdate }) => {
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = async () => {
    try {
      await authService.signOut();
      onLogout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Para debug
  console.log('Dados do usuário no Header:', user);

  // Garante que temos um objeto de usuário válido
  const userData = Array.isArray(user) ? user[0] : user;

  return (
    <header className="bg-[#1e1e1e] shadow-lg fixed w-full top-0 z-50 border-b border-[#404040] mb-6">
      <div className="container mx-auto px-4 py-6 flex justify-between items-center">
        {/* Espaço vazio à esquerda */}
        <div className="w-1/3"></div>
        
        {/* Nome da academia centralizado com tamanho maior */}
        <h1 className="text-3xl font-extrabold text-[#e1aa1e] transition-transform duration-300 hover:scale-105 absolute left-1/2 transform -translate-x-1/2 cursor-pointer">
          Academia Império Fitness
        </h1>
        
        {/* Botões e saudação à direita */}
        {userData && (
          <div className="flex items-center gap-4 ml-auto">
            <span className="text-gray-300">
              Olá, {userData.display_name || userData.full_name}
            </span>
            {userData.role === 'admin' && (
              <button
                onClick={() => setShowSettings(true)}
                className="px-3 py-1.5 text-sm bg-[#e1aa1e] text-gray-900 rounded hover:bg-[#e1aa1e]/80 transition-colors"
                title="Configurações de Usuário"
              >
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Configurações
                </div>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm bg-[#404040] text-gray-300 rounded hover:bg-[#505050] transition-colors"
            >
              Sair
            </button>
          </div>
        )}
      </div>

      {showSettings && userData && userData.role === 'admin' && (
        <UserSettings
          user={userData}
          onClose={() => setShowSettings(false)}
          onSuccess={onUserUpdate}
        />
      )}
    </header>
  );
};

export default Header; 