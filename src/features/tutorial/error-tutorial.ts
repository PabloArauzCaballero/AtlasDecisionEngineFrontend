import { ApiError, errorMessage } from '../../api/ApiError';
import type { NotificationInput } from '../../notifications/notification.types';
import { ERROR_TUTORIALS, errorTutorial } from './interactive-catalog';

type Notify = (input: NotificationInput) => string;
type StartForError = (code: string) => boolean;

interface NotifyErrorParams {
  /** Código de error del backend (p. ej. `VALIDATION_ERROR`). */
  code?: string;
  /** Mensaje técnico, usado como respaldo si el error no tiene tutorial. */
  message: string;
  notify: (input: NotificationInput) => string;
  startForError: (code: string) => boolean;
}

/**
 * Levanta una notificación de error y, si el código tiene un tutorial asociado,
 * agrega una acción "Ver tutorial guiado" que lo inicia. Así un error no queda
 * en un mensaje técnico opaco: guía al usuario a entenderlo y corregirlo.
 */
export function notifyErrorWithTutorial({
  code,
  message,
  notify,
  startForError,
}: NotifyErrorParams): void {
  const link = code ? errorTutorial(code) : null;
  notify({
    tone: 'error',
    title: link ? link.title : 'Ocurrió un error',
    description: link ? link.description : message,
    action: link
      ? { label: 'Ver tutorial guiado', onSelect: () => startForError(code as string) }
      : undefined,
  });
}

/**
 * Notifica un error real de la API llevándolo a un tutorial: prueba primero el
 * código específico del backend y, si no hay tutorial para él, cae al `kind` del
 * error (p. ej. `validation`). Así cualquier error de una familia cubierta ofrece
 * su guía sin depender de un código exacto.
 */
export function notifyApiError(
  error: unknown,
  notify: Notify,
  startForError: StartForError,
): void {
  let code: string | undefined;
  if (error instanceof ApiError) {
    if (error.code && ERROR_TUTORIALS[error.code]) code = error.code;
    else if (ERROR_TUTORIALS[error.kind]) code = error.kind;
  }
  notifyErrorWithTutorial({ code, message: errorMessage(error), notify, startForError });
}
