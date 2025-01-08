export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'client';
  display_name: string;
}

export interface UserListItem {
  id: string;
  username: string;
  full_name: string;
  display_name: string;
  role: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
} 