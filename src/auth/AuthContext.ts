import { createContext } from 'react';
import type { IdentityUser, LoginInput } from './auth.types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: IdentityUser | null;
  login: (input: LoginInput) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshAccessToken: () => Promise<string>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
