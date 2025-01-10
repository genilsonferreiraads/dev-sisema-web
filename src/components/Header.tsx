import React, { useState } from 'react';
import { User } from '../types/auth';
import { authService } from '../lib/auth';
import UserSettings from './UserSettings';
import logo from '../assets/Logo Site Império.png';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onUserUpdate: () => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onUserUpdate }) => {
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = async () => {
    try {
      await authService.signOut();
      onLogout();
    } catch (error) {
      //Silenciosamente lida com o erro
    }
  };

  const userData = Array.isArray(user) ? user[0] : user;

  return (
    <header className="bg-[#1e1e1e] shadow-lg fixed w-full top-0 z-50 border-b border-[#404040]">
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="flex flex-col md:flex-row items-center relative">
          {/* Logo e Nome da academia */}
          <div className="flex items-center gap-3 mb-3 md:mb-0 md:absolute md:left-1/2 md:transform md:-translate-x-1/2 group hover:scale-105 transition-transform duration-300 cursor-pointer">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#e1aa1e]">
              Academia Império Fitness
            </h1>
            <img 
              src={logo} 
              alt="Logo Academia Império Fitness" 
              className="w-10 h-10 md:w-12 md:h-12 object-contain"
            />
          </div>
          
          {/* Botões e saudação */}
          {userData && (
            <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-end md:ml-auto">
              <span className="text-gray-300 text-sm md:text-base truncate">
                Olá, {userData.display_name || userData.full_name}
              </span>
              {userData.role === 'admin' && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-2 md:px-3 py-1 md:py-1.5 text-sm bg-[#e1aa1e] text-gray-900 rounded hover:bg-[#e1aa1e]/80 transition-colors"
                  title="Configurações de Usuário"
                >
                  <div className="flex items-center gap-1 md:gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden md:inline">Configurações</span>
                  </div>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-2 md:px-3 py-1 md:py-1.5 text-sm bg-[#404040] text-gray-300 rounded hover:bg-[#505050] transition-colors"
              >
                Sair
              </button>
            </div>
          )}
        </div>
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