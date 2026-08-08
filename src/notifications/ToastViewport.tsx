'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from './useNotifications';
import type { AppNotification, NotificationTone } from './notification.types';

const TONE_ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const satisfies Record<NotificationTone, typeof Info>;

interface ToastCardProps {
  toast: AppNotification;
  paused: boolean;
  onDismiss: (id: string) => void;
  onPause: () => void;
  onResume: () => void;
}

function ToastCard({ toast, paused, onDismiss, onPause, onResume }: ToastCardProps) {
  // Una operación en curso se anuncia con el icono que gira, no con el del tono.
  const running = toast.progress !== undefined;
  const Icon = running ? Loader2 : TONE_ICON[toast.tone];
  /*
   * Un acierto no detiene su cuenta atrás al pasar el ratón por encima.
   *
   * La pausa existe para dar tiempo a LEER lo que hay que leer y a pulsar lo que
   * hay que pulsar: un fallo, un aviso, una acción ofrecida. Un «se guardó» no
   * pide nada y, si se congela, se queda encima del contenido tapándolo. Los
   * demás tonos y los avisos con acción sí se paran.
   */
  const pausable = toast.tone !== 'success' || Boolean(toast.action);

  return (
    <li
      className={`toast toast-${toast.tone}`}
      data-leaving={toast.leaving ? 'true' : undefined}
      onMouseEnter={pausable ? onPause : undefined}
      onMouseLeave={pausable ? onResume : undefined}
      // Failures interrupt a screen reader; everything else waits its turn.
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span className="toast-icon" data-running={running ? 'true' : undefined}>
        <Icon size={18} />
      </span>
      <div className="toast-copy">
        <strong>
          {toast.title}
          {toast.repeatCount > 1 ? (
            /* Repetir el suceso sube el contador; apilar copias no informaba. */
            <span className="toast-repeat">{`×${toast.repeatCount}`}</span>
          ) : null}
        </strong>
        {toast.description ? <p>{toast.description}</p> : null}
        {running && typeof toast.progress === 'number' ? (
          <span
            className="toast-determinate"
            role="progressbar"
            aria-valuenow={Math.round(toast.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ inlineSize: `${Math.round(toast.progress * 100)}%` }} />
          </span>
        ) : null}
        {toast.action ? (
          <button
            className="toast-action"
            type="button"
            onClick={() => {
              toast.action?.onSelect();
              onDismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        className="icon-button toast-close"
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={`Descartar notificación: ${toast.title}`}
      >
        <X size={14} />
      </button>
      {toast.durationMs === null ? null : (
        <span
          className="toast-progress"
          data-paused={paused ? 'true' : undefined}
          style={{ animationDuration: `${toast.durationMs}ms` }}
        />
      )}
    </li>
  );
}

/**
 * Renders the toast stack in a portal so it escapes any transformed or
 * overflow-clipped ancestor and always sits above the shell.
 */
export function ToastViewport() {
  const { toasts, paused, dismiss, pauseTimers, resumeTimers } = useNotifications();
  const [mounted, setMounted] = useState(false);

  // Portals need a DOM target, which only exists after hydration.
  useEffect(() => setMounted(true), []);

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <ol
      className="toast-viewport"
      aria-label="Notificaciones"
      /*
       * La pausa vive en cada TARJETA, no en la banda.
       *
       * La banda ocupa todo el ancho disponible y flota sobre el contenido, así
       * que colgar aquí `onMouseEnter` congelaba la cuenta atrás con sólo pasar
       * el puntero por el hueco de al lado. Y un aviso congelado sobre un botón
       * lo deja inalcanzable mientras el puntero no se mueva: medido a 390 px en
       * el simulador, «Ver traza de ejecución» quedaba tapado indefinidamente.
       *
       * Con `pointer-events` repartido en la hoja —ninguno en la banda, todos en
       * la tarjeta— el puntero atraviesa el hueco y sólo la tarjeta reacciona.
       * El foco sí se vigila aquí: llega por teclado y siempre cae en un control
       * de dentro.
       */
      onFocusCapture={pauseTimers}
      onBlurCapture={resumeTimers}
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          paused={paused}
          onDismiss={dismiss}
          onPause={pauseTimers}
          onResume={resumeTimers}
        />
      ))}
    </ol>,
    document.body,
  );
}
