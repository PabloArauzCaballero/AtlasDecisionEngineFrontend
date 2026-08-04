'use client';

import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatRelativeTime } from './relative-time';
import { useNotificationInbox } from './useNotificationInbox';
import type { InboxNotification } from './inbox.api';

/** Must match the bell-ring animation in notifications.css. */
const RING_MS = 720;

/** Maps a backend priority to the tone the menu already styles by. */
function toneFor(notification: InboxNotification): string {
  if (notification.priority === 'HIGH') return 'error';
  if (notification.category === 'SECURITY') return 'warning';
  if (notification.category === 'DEPLOYMENT') return 'success';
  return 'info';
}

/**
 * Bell menu backed by the persistent notification inbox (GET /v1/notifications). The badge
 * polls unread-count; the list loads when the panel opens. Opening a notification marks it
 * read (POST /:id/read) and follows its actionUrl; "marcar todas" calls POST /read-all.
 * Transient errors still surface as toasts through the separate NotificationProvider.
 */
export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // The unread badge always polls; the (heavier) list query only runs once the panel opens.
  const { items, unreadCount, isLoading, isError, markRead, markAllRead } =
    useNotificationInbox(open);
  const previousUnread = useRef(unreadCount);

  useEffect(() => {
    const climbed = unreadCount > previousUnread.current;
    previousUnread.current = unreadCount;
    if (!climbed) return;
    setRinging(true);
    const timeout = setTimeout(() => setRinging(false), RING_MS);
    return () => clearTimeout(timeout);
  }, [unreadCount]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      /*
       * Devuelve el foco a la campana. No es un adorno: al cerrarse el panel
       * sus nodos desaparecen y el foco cae al `<body>`, así que quien cerró con
       * Escape se queda al principio del documento y tiene que volver a tabular
       * media página. Sólo se hace con Escape — quien cierra pulsando fuera ya
       * ha decidido dónde quiere estar.
       */
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openItem = (notification: InboxNotification) => {
    if (!notification.readAt) markRead(notification.id);
    setOpen(false);
    if (notification.actionUrl) router.push(notification.actionUrl);
  };

  const label =
    unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones, sin novedades';

  return (
    <div
      className="notification-center"
      ref={container}
      data-tutorial-id="notification-center"
      data-unread={ringing ? 'true' : undefined}
    >
      <button
        ref={trigger}
        className={open ? 'icon-button active' : 'icon-button'}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell />
        {unreadCount > 0 ? (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notification-panel" role="dialog" aria-label="Centro de notificaciones">
          <div className="notification-head">
            <strong>Notificaciones</strong>
            <div className="notification-head-actions">
              <button
                type="button"
                onClick={() => markAllRead()}
                disabled={unreadCount === 0}
                title="Marcar todas como leídas"
              >
                <CheckCheck size={15} /> Marcar todas
              </button>
            </div>
          </div>
          {isLoading ? (
            <div className="notification-empty">
              <span>Cargando notificaciones…</span>
            </div>
          ) : isError ? (
            <div className="notification-empty">
              <BellOff size={26} />
              <span>No se pudieron cargar las notificaciones</span>
            </div>
          ) : items.length === 0 ? (
            <div className="notification-empty">
              <BellOff size={26} />
              <span>Sin notificaciones por ahora</span>
            </div>
          ) : (
            <ul className="notification-list">
              {items.map((item) => (
                <li
                  className="notification-item"
                  key={item.id}
                  data-tone={toneFor(item)}
                  data-read={item.readAt ? 'true' : 'false'}
                >
                  <span className="notification-dot" aria-hidden="true" />
                  <button
                    type="button"
                    className="notification-item-body"
                    onClick={() => openItem(item)}
                  >
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <time dateTime={item.createdAt}>
                      {formatRelativeTime(Date.parse(item.createdAt))}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
