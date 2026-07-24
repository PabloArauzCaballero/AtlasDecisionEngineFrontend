import type { NotificationInput } from '../../notifications/notification.types';
import { errorTutorial } from './interactive-catalog';

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
