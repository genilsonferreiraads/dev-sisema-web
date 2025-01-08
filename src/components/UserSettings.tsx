import React, { useState, useEffect } from 'react';
import { User, UserListItem } from '../types/auth';
import { authService } from '../lib/auth';

interface UserSettingsProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const UserSettings: React.FC<UserSettingsProps> = ({ user, onClose, onSuccess }) => {
  const [selectedUser, setSelectedUser] = useState<string>(user.username);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [showUsernameFields, setShowUsernameFields] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // Carrega a lista de usuários
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const userList = await authService.listUsers();
        setUsers(userList);
      } catch (err) {
        console.error('Erro ao carregar usuários:', err);
      }
    };

    loadUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Validações
      if (newPassword && newPassword !== confirmPassword) {
        setError('As senhas não coincidem');
        return;
      }

      if (newPassword && newPassword.length < 6) {
        setError('A nova senha deve ter pelo menos 6 caracteres');
        return;
      }

      // Atualiza as credenciais do usuário
      const updated = await authService.updateUserCredentials(
        selectedUser,
        newUsername || null,
        newPassword || null
      );

      if (!updated) {
        setError('Erro ao atualizar credenciais do usuário');
        return;
      }

      setSuccess('Credenciais atualizadas com sucesso!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar configurações');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2d2d2d] p-5 rounded-lg shadow-lg w-[480px] border border-[#404040]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#e1aa1e]">
            Configurações de Usuário
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seleção de usuário */}
          <div className="flex gap-4 items-center">
            <label className="text-gray-300 text-sm whitespace-nowrap">
              Usuário:
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-[#1e1e1e] border border-[#404040] rounded-md text-gray-300 text-sm"
            >
              {users.map(user => (
                <option key={user.id} value={user.username}>
                  {user.username} - {user.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Cards de alteração */}
          <div className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => setShowUsernameFields(prev => !prev)}
              className={`p-3 rounded-lg border transition-all cursor-pointer
                ${showUsernameFields 
                  ? 'border-[#e1aa1e] bg-[#e1aa1e]/10' 
                  : 'border-[#404040] hover:border-[#e1aa1e] hover:bg-[#e1aa1e]/5'}`}
            >
              <div className="flex items-center gap-2">
                <svg 
                  className="w-4 h-4 text-[#e1aa1e]" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-gray-300 text-sm">Alterar Nome</span>
              </div>
            </div>

            <div 
              onClick={() => setShowPasswordFields(prev => !prev)}
              className={`p-3 rounded-lg border transition-all cursor-pointer
                ${showPasswordFields 
                  ? 'border-[#e1aa1e] bg-[#e1aa1e]/10' 
                  : 'border-[#404040] hover:border-[#e1aa1e] hover:bg-[#e1aa1e]/5'}`}
            >
              <div className="flex items-center gap-2">
                <svg 
                  className="w-4 h-4 text-[#e1aa1e]" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="text-gray-300 text-sm">Alterar Senha</span>
              </div>
            </div>
          </div>

          {/* Campos de edição */}
          {(showUsernameFields || showPasswordFields) && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                {showUsernameFields && (
                  <div>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#1e1e1e] border border-[#404040] rounded-md text-gray-300 text-sm"
                      placeholder="Novo nome de usuário"
                    />
                  </div>
                )}
                {showPasswordFields && (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#1e1e1e] border border-[#404040] rounded-md text-gray-300 text-sm"
                      placeholder="Nova senha"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#1e1e1e] border border-[#404040] rounded-md text-gray-300 text-sm"
                      placeholder="Confirmar senha"
                    />
                  </div>
                )}
              </div>

              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#1e1e1e] border border-[#404040] rounded-md text-gray-300 text-sm"
                required
                placeholder="Sua senha de administrador"
              />
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#404040] text-gray-300 rounded text-sm hover:bg-[#505050] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !!success}
              className={`px-3 py-1.5 bg-[#e1aa1e] text-gray-900 rounded text-sm font-medium 
                ${(loading || success) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#e1aa1e]/80 transition-colors'}`}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserSettings; 