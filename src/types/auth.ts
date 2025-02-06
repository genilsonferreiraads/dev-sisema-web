export interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
  display_name?: string;
  email?: string;
}

export interface UserListItem {
  id: string;
  username: string;
  full_name: string;
  role: string;
  display_name?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
} 