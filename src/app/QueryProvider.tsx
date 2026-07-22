'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ApiError, errorMessage, type ApiErrorKind } from '../api/ApiError';
import type { NotificationInput, NotificationTone } from '../notifications/notification.types';
import { useNotifications } from '../notifications/useNotifications';

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
  return {
    tone,
    title: TITLE_BY_KIND[error.kind],
    description: error.requestId
      ? `${error.message} · Referencia ${error.requestId}`
      : error.message,
    // Warnings clear themselves; hard failures wait to be acknowledged.
    durationMs: tone === 'warning' ? 7000 : null,
  };
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
          onError: (error) => {
            const notification = toNotification(error);
            if (notification) notifyRef.current(notification);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) =>
              !(error instanceof Error && 'status' in error && error.status === 403) && count < 1,
          },
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
