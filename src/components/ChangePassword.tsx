import React, { useState } from 'react';
import { authService } from '../lib/auth';

interface ChangePasswordProps {
  username: string;
  onClose: () => void;
  isAdmin: boolean;
}

const ChangePassword: React.FC<ChangePasswordProps> = ({ username, onClose, isAdmin }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      setError('Apenas administradores podem alterar senhas');
      return;
    }

    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const changed = await authService.changePassword(username, oldPassword, newPassword);
      if (changed) {
        setSuccess(true);
        setTimeout(onClose, 2000);
      } else {
        setError('Não foi possível alterar a senha. Verifique suas credenciais.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao alterar senha';
      console.error('Erro ao alterar senha:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Se não for admin, nem mostra o componente
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2d2d2d] p-6 rounded-lg shadow-lg w-96 border border-[#404040]">
        <h2 className="text-xl font-semibold mb-4 text-[#e1aa1e]">Alterar Senha</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm">
            Senha alterada com sucesso!
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Senha Atual
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#404040] rounded-md text-gray-300"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Nova Senha
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#404040] rounded-md text-gray-300"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#404040] rounded-md text-gray-300"
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#404040] text-gray-300 rounded hover:bg-[#505050]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className={`px-4 py-2 bg-[#e1aa1e] text-gray-900 rounded font-medium 
                ${(loading || success) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#e1aa1e]/80'}`}
            >
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;