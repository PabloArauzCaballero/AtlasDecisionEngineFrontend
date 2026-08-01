import { ApiError, errorMessage } from '../../api/ApiError';
import type { NotificationInput } from '../../notifications/notification.types';
import { ERROR_TUTORIALS, errorTutorial } from './interactive-catalog';

/**
 * Código con el que buscar el tutorial de un error real de la API: primero el
 * código específico del backend y, si no hay tutorial para él, el `kind` del
 * error (p. ej. `validation`). Así cualquier error de una familia cubierta ofrece
 * su guía sin depender de un código exacto.
 */
export function tutorialCodeFor(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.code && ERROR_TUTORIALS[error.code]) return error.code;
  return ERROR_TUTORIALS[error.kind] ? error.kind : undefined;
}

/**
 * Notifica un error de la API llevándolo, si existe, a su tutorial guiado.
 *
 * Para vistas que NO tienen una superficie propia donde explicar el fallo. La
 * mutación debe declarar `meta: { handled: true }` para que el aviso global de
 * `QueryProvider` no anuncie el mismo error una segunda vez.
 */
export function notifyApiError(
  error: unknown,
  notify: (input: NotificationInput) => string,
  startForError: (code: string) => boolean,
): void {
  const code = tutorialCodeFor(error);
  const link = code ? errorTutorial(code) : null;
  notify({
    tone: 'error',
    title: link ? link.title : 'Ocurrió un error',
    description: link ? link.description : errorMessage(error),
    action: link
      ? { label: 'Ver tutorial guiado', onSelect: () => startForError(code as string) }
      : undefined,
  });
}
