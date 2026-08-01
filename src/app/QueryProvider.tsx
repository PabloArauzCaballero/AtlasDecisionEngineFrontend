'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ApiError, errorMessage, type ApiErrorKind } from '../api/ApiError';
import type { NotificationInput, NotificationTone } from '../notifications/notification.types';
import { useNotifications } from '../notifications/useNotifications';
import { errorTutorial } from '../features/tutorial/interactive-catalog';

/** Operator-facing headline per failure kind; the API message is the detail. */
const TITLE_BY_KIND: Record<ApiErrorKind, string> = {
  validation: 'Datos inválidos',
  unauthorized: 'Sesión expirada',
  forbidden: 'Permiso denegado',
  'not-found': 'Recurso no encontrado',
  conflict: 'Conflicto de estado',
  'rate-limit': 'Límite de peticiones alcanzado',
  network: 'Sin conexión con el backend',
  timeout: 'La operación tardó demasiado',
  cancelled: 'Operación cancelada',
  contract: 'Respuesta inesperada del backend',
  unexpected: 'La operación no se completó',
};

/** Expected outcomes an operator can act on, rather than system failures. */
const WARNING_KINDS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'validation',
  'forbidden',
  'not-found',
  'conflict',
  'rate-limit',
]);

function toNotification(error: unknown): NotificationInput | null {
  if (!(error instanceof ApiError)) {
    return {
      tone: 'error',
      title: 'La operación no se completó',
      description: errorMessage(error),
    };
  }
  // A cancelled request is almost always the user navigating away mid-flight.
  if (error.kind === 'cancelled') return null;

  const tone: NotificationTone = WARNING_KINDS.has(error.kind) ? 'warning' : 'error';
  // Si el código del backend tiene una explicación comprensible en el catálogo,
  // la usamos en vez del mensaje técnico crudo (p. ej. "Version in state
  // DEPLOYED_TO_PROD cannot be validated" → "Esta versión ya no se puede validar…").
  const link = error.code ? errorTutorial(error.code) : null;
  const detail = link ? link.description : error.message;
  return {
    tone,
    title: link ? link.title : TITLE_BY_KIND[error.kind],
    description: error.requestId ? `${detail} · Referencia ${error.requestId}` : detail,
    // Warnings clear themselves; hard failures wait to be acknowledged.
    durationMs: tone === 'warning' ? 7000 : null,
  };
}

/**
 * Fallos que reintentar no arregla.
 *
 * Sólo merece un segundo intento lo que pudo fallar por el camino: un corte de
 * red, un tiempo agotado, un 5xx. Un 404 seguirá sin existir y un 422 seguirá
 * siendo inválido, así que repetirlos sólo dobla la espera del operador antes
 * de ver el error. El 401 lo resuelve `apiRequest` renovando el token, y el 429
 * empeora al insistir.
 */
const NON_RETRYABLE: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'validation',
  'unauthorized',
  'forbidden',
  'not-found',
  'conflict',
  'rate-limit',
  'cancelled',
]);

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  return !(error instanceof ApiError && NON_RETRYABLE.has(error.kind));
}

/**
 * Owns the React Query client and reports every failed mutation as a toast.
 *
 * Centralising this in the cache means each new mutation gets error feedback by
 * default — pages opt into success messages, never out of failure ones.
 */
export function QueryProvider({ children }: PropsWithChildren) {
  const { notify } = useNotifications();
  // The client is built once, so it must reach `notify` through a ref rather
  // than capturing the value from this render.
  const notifyRef = useRef(notify);

  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Una vista puede declarar que ELLA muestra el fallo (`meta.handled`),
            // p. ej. con un diálogo que además ofrece el tutorial para corregirlo.
            // Sin esto el mismo error se anunciaba dos veces: el aviso global y la
            // superficie propia de la vista.
            if (mutation.meta?.handled) return;
            const notification = toNotification(error);
            if (notification) notifyRef.current(notification);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: shouldRetryQuery,
          },
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
