import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { configureHttpClient } from '../api/http-client';
import { AuthContext, type AuthStatus } from './AuthContext';
import * as authApi from './auth.api';
import type { IdentityUser, LoginInput, SessionPayload } from './auth.types';
import { tokenExpirationMs } from './token';

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<IdentityUser | null>(null);
  const [sessionRevision, setSessionRevision] = useState(0);
  const tokenRef = useRef<string | null>(null);
  const refreshRef = useRef<Promise<SessionPayload> | null>(null);

  const applySession = useCallback((session: SessionPayload) => {
    tokenRef.current = session.accessToken;
    setUser(session.user);
    setStatus('authenticated');
    setSessionRevision((revision) => revision + 1);
  }, []);

  const expireSession = useCallback(() => {
    tokenRef.current = null;
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refreshSession = useCallback(async () => {
    refreshRef.current ??= authApi.refresh().finally(() => {
      refreshRef.current = null;
    });
    const session = await refreshRef.current;
    applySession(session);
    return session;
  }, [applySession]);

  const refreshAccessToken = useCallback(async () => {
    try {
      return (await refreshSession()).accessToken;
    } catch (error) {
      expireSession();
      throw error;
    }
  }, [expireSession, refreshSession]);

  useEffect(
    () =>
      configureHttpClient({
        getAccessToken: () => tokenRef.current,
        refreshAccessToken,
        expireSession,
      }),
    [expireSession, refreshAccessToken],
  );

  useEffect(() => {
    let active = true;
    authApi
      .restoreSession()
      .then((session) => {
        if (active) applySession(session);
      })
      .catch(() => {
        if (active) expireSession();
      });
    return () => {
      active = false;
    };
  }, [applySession, expireSession]);

  useEffect(() => {
    const token = tokenRef.current;
    if (status !== 'authenticated' || !token) return;
    const expiration = tokenExpirationMs(token);
    const delay = expiration ? Math.max(1_000, expiration - Date.now() - 60_000) : 10 * 60_000;
    const timer = window.setTimeout(() => {
      void refreshAccessToken().catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [status, sessionRevision, refreshAccessToken]);

  const login = useCallback(
    async (input: LoginInput) => {
      applySession(await authApi.login(input));
    },
    [applySession],
  );

  const logout = useCallback(
    async (allDevices = false) => {
      expireSession();
      try {
        await authApi.logout(allDevices);
      } catch {
        // Local logout must always complete even if the identity provider is temporarily unavailable.
      }
    },
    [expireSession],
  );

  const value = useMemo(
    () => ({ status, user, login, logout, refreshAccessToken }),
    [status, user, login, logout, refreshAccessToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
