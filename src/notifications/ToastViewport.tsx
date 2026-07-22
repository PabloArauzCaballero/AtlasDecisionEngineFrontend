'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
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
}

function ToastCard({ toast, paused, onDismiss }: ToastCardProps) {
  const Icon = TONE_ICON[toast.tone];

  return (
    <li
      className={`toast toast-${toast.tone}`}
      data-leaving={toast.leaving ? 'true' : undefined}
      // Failures interrupt a screen reader; everything else waits its turn.
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span className="toast-icon">
        <Icon size={18} />
      </span>
      <div className="toast-copy">
        <strong>{toast.title}</strong>
        {toast.description ? <p>{toast.description}</p> : null}
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
      // Countdowns freeze while the pointer is over the stack, and while a
      // toast holds focus, so keyboard users get the same reading time.
      onMouseEnter={pauseTimers}
      onMouseLeave={resumeTimers}
      onFocusCapture={pauseTimers}
      onBlurCapture={resumeTimers}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} paused={paused} onDismiss={dismiss} />
      ))}
    </ol>,
    document.body,
  );
}
