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
  const [newRole, setNewRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: 'client'
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [formData, setFormData] = useState<any>(null);

  // Atualiza o usuário selecionado quando clicar em Editar
  useEffect(() => {
    if (showEditUser && users.length > 0) {
      const userToEdit = users.find(u => u.username === selectedUser);
      if (!userToEdit) {
        setSelectedUser(users[0].username);
      }
    }
  }, [showEditUser, users]);

  // Carrega a lista de usuários
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const userList = await authService.listUsers();
        setUsers(userList);
      } catch (err) {
        setError('Erro ao carregar lista de usuários');
      }
    };

    loadUsers();
  }, []);

  // Remove o log do estado users
  useEffect(() => {
    // Mantém o efeito vazio para preservar a funcionalidade de atualização
  }, [users]);

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      if (!selectedUser) {
        throw new Error('Nenhum usuário selecionado');
      }

      if (!adminPassword) {
        throw new Error('Senha de administrador é obrigatória');
      }

      setLoading(true);
      const updatedUser = await authService.updateUserCredentials(
        selectedUser,
        newUsername || null,
        newPassword || null,
        newRole
      );

      if (!updatedUser) {
        throw new Error('Erro ao atualizar credenciais do usuário');
      }

      // Atualiza a lista de usuários
      const userList = await authService.listUsers();
      setUsers(userList);
      
      setSuccess('Usuário atualizado com sucesso!');
      
      // Limpa o formulário e fecha os modais
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      setAdminPassword('');
      setNewRole(null);
      setShowEditUser(false);
      setShowAdminPasswordModal(false);
      setPendingAction(null);
      setFormData(null);

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      setError(error.message || 'Erro ao atualizar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    try {
      if (!newUserData.username || !newUserData.password || !newUserData.fullName || !adminPassword) {
        throw new Error('Todos os campos são obrigatórios');
      }

      if (newUserData.password !== newUserData.confirmPassword) {
        throw new Error('As senhas não coincidem');
      }

      if (newUserData.password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres');
      }

      setLoading(true);
      const createdUser = await authService.createUser(
        newUserData.username,
        newUserData.password,
        newUserData.fullName,
        adminPassword,
        newUserData.role
      );

      if (!createdUser) {
        throw new Error('Erro ao criar usuário');
      }

      // Atualiza a lista de usuários
      const userList = await authService.listUsers();
      setUsers(userList);
      
      setSuccess('Usuário criado com sucesso!');
      
      // Limpa o formulário e fecha os modais
      setNewUserData({
        username: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        role: 'client'
      });
      setAdminPassword('');
      setShowCreateUser(false);
      setShowAdminPasswordModal(false);
      setPendingAction(null);
      setFormData(null);

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      setError(error.message || 'Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      if (!adminPassword) {
        throw new Error('Senha de administrador é obrigatória');
      }

      const selectedUserData = users.find(u => u.username === selectedUser);
      
      // Não permite excluir administradores
      if (selectedUserData?.role === 'admin') {
        throw new Error('Não é possível excluir usuários administradores');
      }

      setLoading(true);
      const deleted = await authService.deleteUser(selectedUser, adminPassword);

      if (!deleted) {
        throw new Error('Erro ao excluir usuário');
      }

      // Atualiza a lista de usuários
      const userList = await authService.listUsers();
      setUsers(userList);

      setSuccess('Usuário excluído com sucesso!');
      
      // Limpa os estados e fecha os modais
      setShowEditUser(false);
      setShowDeleteConfirm(false);
      setShowAdminPasswordModal(false);
      setAdminPassword('');
      setPendingAction(null);
      setFormData(null);

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      setError(error.message || 'Erro ao excluir usuário');
    } finally {
      setLoading(false);
    }
  };

  // AdminPasswordModal Component
  const AdminPasswordModal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-[#2d2d2d] to-[#252525] p-3 sm:p-6 rounded-xl shadow-2xl w-[95%] sm:w-[400px] max-w-[400px] border border-[#404040]/50 mx-2">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="p-2 bg-[#e1aa1e]/10 rounded-lg">
            <svg className="w-5 h-5 text-[#e1aa1e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#e1aa1e]">Senha de Administrador</h3>
        </div>
        <div className="space-y-4">
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
              focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
            placeholder="Digite sua senha de administrador"
            autoComplete="off"
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => {
                setShowAdminPasswordModal(false);
                setPendingAction(null);
                setFormData(null);
                setAdminPassword('');
                if (pendingAction === 'delete') {
                  setShowDeleteConfirm(false);
                }
              }}
              className="px-4 py-2.5 bg-[#1e1e1e]/80 text-gray-300 rounded-lg text-sm font-medium
                hover:bg-[#1e1e1e] transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingAction === 'create') {
                  handleCreateUser(formData);
                } else if (pendingAction === 'edit') {
                  handleSubmit(formData);
                } else if (pendingAction === 'delete') {
                  handleDeleteUser();
                }
              }}
              disabled={!adminPassword || loading}
              className={`px-6 py-2.5 bg-gradient-to-r from-[#e1aa1e] to-[#d19200] text-gray-900 rounded-lg text-sm font-medium
                ${(!adminPassword || loading) 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:from-[#e1aa1e]/90 hover:to-[#d19200]/90 transition-all duration-200 shadow-lg shadow-[#e1aa1e]/20 active:scale-[0.98]'}`}
            >
              {loading ? 'Processando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Modify the form submission handlers
  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormData(e);
    setPendingAction('create');
    setShowAdminPasswordModal(true);
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormData(e);
    setPendingAction('edit');
    setShowAdminPasswordModal(true);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-[#2d2d2d] to-[#252525] p-3 sm:p-6 rounded-xl shadow-2xl w-[95%] sm:w-[500px] max-w-[500px] border border-[#404040]/50 mx-2 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-[#e1aa1e]/10 rounded-lg">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#e1aa1e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h2 className="text-base sm:text-xl font-semibold text-[#e1aa1e]">
              {showCreateUser ? 'Criar Novo Usuário' : 'Configurações de Usuário'}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {!showCreateUser && (
              <button
                onClick={() => {
                  setShowCreateUser(prev => !prev);
                  setShowEditUser(false);
                }}
                className="p-2 text-gray-400 hover:text-[#e1aa1e] transition-all duration-200 hover:bg-[#e1aa1e]/10 rounded-lg"
                title="Criar Novo Usuário"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-200 transition-all duration-200 hover:bg-white/5 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg backdrop-blur-sm">
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          {!showCreateUser && !showEditUser && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label className="text-gray-300 text-sm font-medium whitespace-nowrap">
                    Usuário:
                  </label>
                  {users.length > 0 ? (
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040]/50 rounded-lg text-gray-300 text-xs sm:text-sm
                        focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all truncate"
                    >
                      {users.map(user => (
                        <option key={user.id} value={user.username} className="truncate">
                          {user.username} - {user.role === 'admin' ? '👑 Admin' : '👤 Cliente'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex-1 text-xs sm:text-sm text-gray-400 animate-pulse">
                      Carregando usuários...
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  const userToEdit = users.find(u => u.username === selectedUser);
                  if (userToEdit) {
                    setShowEditUser(true);
                    setShowCreateUser(false);
                    setNewUsername('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setNewRole(null);
                  }
                }}
                className="w-full py-2.5 bg-gradient-to-r from-[#e1aa1e] to-[#d19200] text-gray-900 rounded-lg text-sm font-medium 
                  hover:from-[#e1aa1e]/90 hover:to-[#d19200]/90 transition-all duration-200 shadow-lg shadow-[#e1aa1e]/20
                  active:scale-[0.98]"
              >
                Editar Usuário
              </button>
            </div>
          )}

          {showCreateUser && (
            <form id="createUserForm" onSubmit={handleCreateUserSubmit} className="space-y-4" autoComplete="off">
              <input
                type="text"
                value={newUserData.username}
                onChange={(e) => setNewUserData(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
                  focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
                placeholder="Nome de usuário"
                autoComplete="off"
              />
              <input
                type="text"
                value={newUserData.fullName}
                onChange={(e) => setNewUserData(prev => ({ ...prev, fullName: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
                  focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
                placeholder="Nome completo"
                autoComplete="off"
              />
              <div className="flex gap-4 items-center">
                <label className="text-gray-300 text-sm font-medium whitespace-nowrap">
                  Tipo de Usuário:
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, role: e.target.value }))}
                  className="flex-1 px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
                    focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
                  autoComplete="off"
                >
                  <option value="client">👤 Cliente</option>
                  <option value="admin">👑 Administrador</option>
                </select>
              </div>
              <input
                type="password"
                value={newUserData.password}
                onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
                  focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
                placeholder="Senha"
                autoComplete="new-password"
              />
              <input
                type="password"
                value={newUserData.confirmPassword}
                onChange={(e) => setNewUserData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
                  focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
                placeholder="Confirmar senha"
                autoComplete="new-password"
              />
            </form>
          )}

          {showEditUser && (
            <form id="editUserForm" onSubmit={handleEditUserSubmit} className="space-y-4" autoComplete="off">
              {/* Informações do usuário selecionado */}
              <div className="p-4 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg backdrop-blur-sm mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#e1aa1e]/10 rounded-lg">
                      <svg className="w-5 h-5 text-[#e1aa1e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-[#e1aa1e] font-medium">Usuário Selecionado</span>
                  </div>
                  {users.find(u => u.username === selectedUser)?.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAction('delete');
                        setShowAdminPasswordModal(true);
                      }}
                      className="p-2 text-red-400 hover:text-red-300 transition-all duration-200 hover:bg-red-500/10 rounded-lg group relative"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                        Excluir Usuário
                      </span>
                    </button>
                  )}
                </div>
                {users.find(u => u.username === selectedUser) && (
                  <div className="text-gray-300 text-sm space-y-2">
                    <p className="flex items-center gap-2">
                      <span className="text-gray-400 min-w-[120px]">Nome de Usuário:</span>
                      <span className="font-medium">{selectedUser}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-gray-400 min-w-[120px]">Nome Completo:</span>
                      <span className="font-medium">{users.find(u => u.username === selectedUser)?.full_name}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-gray-400 min-w-[120px]">Função:</span>
                      {users.find(u => u.username === selectedUser)?.role === 'admin' ? (
                        <span className="text-[#e1aa1e] font-medium">👑 Administrador</span>
                      ) : (
                        <span className="text-gray-300 font-medium">👤 Cliente</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Título para mudar dados do usuário */}
              <div className="p-4 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg backdrop-blur-sm mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#e1aa1e]/10 rounded-lg">
                    <svg className="w-5 h-5 text-[#e1aa1e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <span className="text-[#e1aa1e] font-medium">Mudar Dados do Usuário</span>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
                    focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
                  placeholder="Novo nome de usuário (opcional)"
                  autoComplete="off"
                />
                <div className="flex gap-3">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
                      focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
                    placeholder="Nova senha (opcional)"
                    autoComplete="new-password"
                  />
                  {newPassword && (
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
                        focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
                      placeholder="Confirmar nova senha"
                      autoComplete="new-password"
                    />
                  )}
                </div>
                <div className="flex gap-4 items-center">
                  <label className="text-gray-300 text-sm font-medium whitespace-nowrap">
                    Alterar Função:
                  </label>
                  <select
                    value={newRole || ''}
                    onChange={(e) => setNewRole(e.target.value || null)}
                    className="flex-1 px-4 py-2.5 bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg text-gray-300 text-sm
                      focus:border-[#e1aa1e]/50 focus:ring-1 focus:ring-[#e1aa1e]/50 transition-all"
                    autoComplete="off"
                  >
                    <option value="">Manter função atual</option>
                    <option value="client">👤 Cliente</option>
                    <option value="admin">👑 Administrador</option>
                  </select>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer Buttons */}
        {(showCreateUser || showEditUser) && (
          <div className="flex justify-end gap-3 pt-3 mt-3 border-t border-[#404040]/50">
            <button
              type="button"
              onClick={() => {
                setShowEditUser(false);
                setShowCreateUser(false);
                setNewUsername('');
                setNewPassword('');
                setConfirmPassword('');
                setAdminPassword('');
                setShowDeleteConfirm(false);
                setNewRole(null);
                setNewUserData({
                  username: '',
                  password: '',
                  confirmPassword: '',
                  fullName: '',
                  role: 'client'
                });
              }}
              className="px-4 py-2.5 bg-[#1e1e1e]/80 text-gray-300 rounded-lg text-sm font-medium
                hover:bg-[#1e1e1e] transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={showCreateUser ? "createUserForm" : "editUserForm"}
              disabled={loading || !!success}
              className={`px-6 py-2.5 bg-gradient-to-r from-[#e1aa1e] to-[#d19200] text-gray-900 rounded-lg text-sm font-medium
                ${(loading || success) 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:from-[#e1aa1e]/90 hover:to-[#d19200]/90 transition-all duration-200 shadow-lg shadow-[#e1aa1e]/20 active:scale-[0.98]'}`}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}

        {/* Modals */}
        {showAdminPasswordModal && <AdminPasswordModal />}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-b from-[#2d2d2d] to-[#252525] p-3 sm:p-6 rounded-xl shadow-2xl w-[95%] sm:w-[400px] max-w-[400px] border border-[#404040]/50 mx-2">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-red-400">Confirmar Exclusão</h3>
              </div>
              <div className="bg-[#1e1e1e]/80 border border-[#404040]/50 rounded-lg p-4 mb-4 backdrop-blur-sm">
                <p className="text-gray-300 text-sm mb-3">
                  Tem certeza que deseja excluir o usuário <strong className="text-red-400">{selectedUser}</strong>?
                </p>
                <p className="text-gray-400 text-sm">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2.5 bg-[#1e1e1e]/80 text-gray-300 rounded-lg text-sm font-medium
                    hover:bg-[#1e1e1e] transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setPendingAction('delete');
                    setShowAdminPasswordModal(true);
                  }}
                  disabled={loading}
                  className={`px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg text-sm font-medium
                    ${loading 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:from-red-500/90 hover:to-red-600/90 transition-all duration-200 shadow-lg shadow-red-500/20 active:scale-[0.98]'}`}
                >
                  {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSettings; 