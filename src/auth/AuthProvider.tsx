import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { SessionExpiryDialog } from './SessionExpiryDialog';
import { useSessionLimits } from './useSessionLimits';
import { configureHttpClient } from '../api/http-client';
import { AuthContext, type AuthStatus } from './AuthContext';
import * as authApi from './auth.api';
import {
  isPinChallenge,
  type IdentityUser,
  type LoginInput,
  type LoginOutcome,
  type LoginPinInput,
  type SessionPayload,
} from './auth.types';
import { tokenExpirationMs } from './token';

/** Quién es la sesión, para saber cuándo la caché dejó de pertenecerle. */
function identityOf(user: IdentityUser): string {
  return `${user.tenantId}:${user.id}`;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<IdentityUser | null>(null);
  const [sessionRevision, setSessionRevision] = useState(0);
  const tokenRef = useRef<string | null>(null);
  const refreshRef = useRef<Promise<SessionPayload> | null>(null);
  const identityRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  /*
   * La caché de React Query vive por ENCIMA de esta sesión, así que hay que
   * vaciarla a mano.
   *
   * `QueryProvider` construye el cliente una sola vez por pestaña y el layout
   * raíz no se desmonta al navegar, de modo que cerrar sesión con
   * `router.replace('/login')` —una navegación de cliente— no se llevaba nada:
   * las respuestas de quien acababa de salir seguían en memoria hasta que el
   * recolector de React Query las tirase, cinco minutos después. Y ninguna
   * `queryKey` del portal lleva tenant ni usuario, así que la siguiente persona
   * que entrase en esa misma pestaña las recibía al instante mientras
   * revalidaba, que es el comportamiento normal de `staleTime` jugando en
   * contra. Una estación compartida por turnos es justo el modo de uso previsto.
   */
  const applySession = useCallback(
    (session: SessionPayload) => {
      const identity = identityOf(session.user);
      // Renovar el token reaplica la MISMA sesión: sólo se tira la caché cuando
      // de verdad cambia de manos, o cada renovación borraría el trabajo en curso.
      if (identityRef.current && identityRef.current !== identity) queryClient.clear();
      identityRef.current = identity;
      tokenRef.current = session.accessToken;
      setUser(session.user);
      setStatus('authenticated');
      setSessionRevision((revision) => revision + 1);
    },
    [queryClient],
  );

  const expireSession = useCallback(() => {
    identityRef.current = null;
    tokenRef.current = null;
    setUser(null);
    setStatus('unauthenticated');
    // Se vacía al SALIR y no al entrar: en ese momento ninguna vista del portal
    // sigue montada, así que nadie ve un parpadeo y no hay carrera con el
    // siguiente acceso.
    queryClient.clear();
  }, [queryClient]);

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

  const expireByLimit = useCallback(() => {
    expireSession();
    // El motor también debe enterarse: cerrar sólo en el navegador deja el
    // refresh token vivo, y entonces el tope no ha cerrado nada de verdad.
    void authApi.logout(false).catch(() => undefined);
  }, [expireSession]);

  const { secondsLeft, cause, keepAlive, idleExceeded } = useSessionLimits({
    active: status === 'authenticated',
    onExpire: expireByLimit,
  });

  useEffect(() => {
    const token = tokenRef.current;
    if (status !== 'authenticated' || !token) return;
    const expiration = tokenExpirationMs(token);
    const delay = expiration ? Math.max(1_000, expiration - Date.now() - 60_000) : 10 * 60_000;
    const timer = window.setTimeout(() => {
      /*
       * La renovación ya NO es incondicional.
       *
       * Renovar sin mirar si hay alguien delante convertía este temporizador en
       * lo contrario de un control de sesión: mantenía viva indefinidamente la
       * pestaña que nadie estaba usando, que es exactamente la que hay que
       * cerrar. Si el tope de inactividad ya venció, se cierra en vez de
       * renovar; el sondeo de `useSessionLimits` llega como muy tarde un
       * segundo después, pero este camino puede adelantarse a él.
       */
      if (idleExceeded()) {
        expireByLimit();
        return;
      }
      void refreshAccessToken().catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [status, sessionRevision, refreshAccessToken, expireByLimit, idleExceeded]);

  /*
   * Una contraseña correcta ya no significa "hay sesión".
   *
   * Cuando el proveedor exige segundo factor, este paso devuelve un desafío y NO se aplica sesión
   * ninguna: no hay token que guardar todavía. El desenlace se devuelve tal cual para que la
   * pantalla de acceso pida el PIN; darlo por bueno aquí habría dejado el portal creyéndose
   * autenticado con las manos vacías.
   */
  const login = useCallback(
    async (input: LoginInput): Promise<LoginOutcome> => {
      const outcome = await authApi.login(input);
      if (!isPinChallenge(outcome)) applySession(outcome);
      return outcome;
    },
    [applySession],
  );

  const verifyLoginPin = useCallback(
    async (input: LoginPinInput) => {
      applySession(await authApi.verifyLoginPin(input));
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
    () => ({ status, user, login, verifyLoginPin, logout, refreshAccessToken }),
    [status, user, login, verifyLoginPin, logout, refreshAccessToken],
  );
  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* El aviso vive aquí y no en el armazón del portal: la cuenta atrás no
          puede depender de qué vista esté montada. */}
      <SessionExpiryDialog
        secondsLeft={secondsLeft}
        cause={cause}
        onStay={keepAlive}
        onLeave={() => void logout()}
      />
    </AuthContext.Provider>
  );
}
