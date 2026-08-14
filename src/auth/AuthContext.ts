import { createContext } from 'react';
import type { IdentityUser, LoginInput, LoginOutcome, LoginPinInput } from './auth.types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: IdentityUser | null;
  /**
   * Devuelve el desenlace en vez de `void`: con segundo factor, la contraseña correcta todavía no
   * abre sesión, y quien llama necesita saberlo para pedir el PIN en vez de navegar a una vista
   * que aún no puede ver.
   */
  login: (input: LoginInput) => Promise<LoginOutcome>;
  verifyLoginPin: (input: LoginPinInput) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshAccessToken: () => Promise<string>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
