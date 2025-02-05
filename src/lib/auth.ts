import { supabase } from './supabase';
import { User, UserListItem } from '../types/auth';

export const authService = {
  async signIn(username: string, password: string): Promise<User | null> {
    if (!username || !password) return null;

    try {
      const { data, error } = await supabase
        .rpc('check_password', {
          p_username: username,
          p_password: password
        });

      if (error) throw error;
      
      if (data && Array.isArray(data) && data.length > 0) {
        const user = data[0];
        
        const userData: User = {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          display_name: user.display_name
        };
        
        sessionStorage.setItem('user', JSON.stringify(userData));
        return userData;
      }

      return null;
    } catch (error) {
      throw error;
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const storedUser = sessionStorage.getItem('user');
      if (!storedUser) return null;

      const currentUser = JSON.parse(storedUser) as User;
      
      // Se não houver conexão, retorna o usuário do sessionStorage
      if (!navigator.onLine) {
        return currentUser;
      }
      
      const { data, error } = await supabase
        .rpc('get_user_data', {
          p_username: currentUser.username
        });

      if (error || !data) {
        console.error('Erro ao buscar usuário:', error);
        // Se o erro for de conexão, retorna o usuário do sessionStorage
        if (error?.message?.includes('Failed to fetch') || 
            error?.message?.includes('Network Error') || 
            !navigator.onLine) {
          return currentUser;
        }
        sessionStorage.removeItem('user');
        return null;
      }

      // Garante que retornamos um objeto único, não um array
      const updatedUser: User = Array.isArray(data) ? data[0] : data;
      
      // Atualiza o sessionStorage com os dados mais recentes
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;

    } catch (error) {
      console.error('Erro ao obter usuário atual:', error);
      // Se o erro for de conexão, retorna o usuário do sessionStorage
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('Network Error') || 
        !navigator.onLine
      )) {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) {
          return JSON.parse(storedUser) as User;
        }
      }
      sessionStorage.removeItem('user');
      return null;
    }
  },

  async signOut() {
    sessionStorage.removeItem('user');
    await supabase.auth.signOut();
  },

  async changePassword(username: string, adminPassword: string, newPassword: string): Promise<boolean> {
    try {
      if (!username || !adminPassword || !newPassword) {
        throw new Error('Todos os campos são obrigatórios');
      }

      // Pega o usuário atual do sessionStorage
      const currentUser = sessionStorage.getItem('user');
      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .rpc('change_password', {
          p_username: username,
          p_admin_password: adminPassword,
          p_new_password: newPassword
        });

      if (error) {
        throw error;
      }

      return data || false;
    } catch (error) {
      throw error;
    }
  },

  async updateUsername(currentUsername: string, newUsername: string, adminPassword: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('update_username', {
        p_current_username: currentUsername,
        p_new_username: newUsername,
        p_admin_password: adminPassword
      });

    if (error) throw error;
    return data || false;
  },

  async updateDisplayName(username: string, newDisplayName: string, adminPassword: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('update_display_name', {
        p_username: username,
        p_display_name: newDisplayName,
        p_admin_password: adminPassword
      });

    if (error) throw error;
    return data || false;
  },

  async listUsers(): Promise<UserListItem[]> {
    try {
      const { data, error } = await supabase
        .rpc('list_users');

      if (error) throw error;

      return data || [];
    } catch (error) {
      throw error;
    }
  },

  async updateUserCredentials(
    username: string, 
    newUsername: string | null, 
    newPassword: string | null,
    newRole: string | null
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('update_user_credentials', {
          p_username: username,
          p_new_username: newUsername,
          p_new_password: newPassword,
          p_new_role: newRole
        });

      if (error) {
        console.error('Erro ao atualizar credenciais do usuário:', error);
        throw error;
      }

      return data || false;
    } catch (error) {
      console.error('Erro ao atualizar credenciais do usuário:', error);
      throw error;
    }
  },

  async createUser(
    newUsername: string, 
    password: string, 
    fullName: string, 
    adminPassword: string,
    role: string = 'client'
  ): Promise<boolean> {
    try {
      const params = {
        p_username: newUsername,
        p_password: password,
        p_full_name: fullName,
        p_role: role
      };

      const { data, error } = await supabase
        .rpc('create_user', params);

      if (error) {
        throw error;
      }

      return data || false;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Erro ao criar usuário:', error.message);
      } else {
        console.error('Erro não identificado ao criar usuário');
      }
      throw error;
    }
  },

  async deleteUser(username: string, adminPassword: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('delete_user', {
          p_username: username,
          p_admin_password: adminPassword
        });

      if (error) {
        throw error;
      }

      return data || false;
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      throw error;
    }
  }
}; 