import React, { useState } from 'react';
import { authService } from '../lib/auth';

interface EditUsernameProps {
  currentUsername: string;
  onClose: () => void;
  isAdmin: boolean;
  onSuccess: () => void;
}

const EditUsername: React.FC<EditUsernameProps> = ({ 
  currentUsername, 
  onClose, 
  isAdmin,
  onSuccess 
}) => {
  const [newUsername, setNewUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      setError('Apenas administradores podem alterar nomes de usuário');
      return;
    }

    setError(null);

    if (newUsername.length < 3) {
      setError('O nome de usuário deve ter pelo menos 3 caracteres');
      return;
    }

    setLoading(true);

    try {
      const updated = await authService.updateUsername(
        currentUsername,
        newUsername,
        adminPassword
      );

      if (updated) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError('Senha do administrador incorreta');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar nome de usuário');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2d2d2d] p-6 rounded-lg shadow-lg w-96 border border-[#404040]">
        <h2 className="text-xl font-semibold mb-4 text-[#e1aa1e]">Alterar Nome de Usuário</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm">
            Nome de usuário alterado com sucesso!
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Novo Nome de Usuário
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#404040] rounded-md text-gray-300"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Sua Senha (Admin)
            </label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
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
              {loading ? 'Alterando...' : 'Alterar Nome'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUsername; 