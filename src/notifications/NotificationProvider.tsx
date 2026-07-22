'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { NotificationContext } from './NotificationContext';
import type { AppNotification, NotificationInput, NotificationTone } from './notification.types';

/** Toasts visible at once. Older ones retire early rather than build a wall. */
const MAX_VISIBLE = 4;
/** Entries kept for the bell menu. */
const MAX_HISTORY = 40;
/** Must match the exit animation in notifications.css. */
const EXIT_MS = 180;

/**
 * Time on screen per tone. Typed as a total map over the tone union so a lookup
 * cannot miss — `null` here means "sticky" and must never be coalesced away.
 */
const DEFAULT_DURATION: Record<NotificationTone, number | null> = {
  success: 4500,
  info: 5000,
  warning: 7000,
  // Failures stay until acknowledged: an operator must never miss one.
  error: null,
};

interface Countdown {
  timeoutId: ReturnType<typeof setTimeout>;
  /** Milliseconds still owed when the countdown last started. */
  remaining: number;
  startedAt: number;
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [history, setHistory] = useState<AppNotification[]>([]);
  const [paused, setPaused] = useState(false);
  const countdowns = useRef(new Map<string, Countdown>());
  const sequence = useRef(0);

  const clearCountdown = useCallback((id: string) => {
    const countdown = countdowns.current.get(id);
    if (countdown) clearTimeout(countdown.timeoutId);
    countdowns.current.delete(id);
  }, []);

  /** Drops a toast from the DOM. Only ever called after the exit animation. */
  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Starts the exit animation, then removes on a fixed timer rather than an
   * `animationend` listener — under reduced motion the animation is compressed
   * to ~0ms and the event can be missed, which would strand the toast.
   */
  const dismiss = useCallback(
    (id: string) => {
      clearCountdown(id);
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
      );
      setTimeout(() => remove(id), EXIT_MS);
    },
    [clearCountdown, remove],
  );

  const startCountdown = useCallback(
    (id: string, remaining: number) => {
      clearCountdown(id);
      countdowns.current.set(id, {
        timeoutId: setTimeout(() => dismiss(id), remaining),
        remaining,
        startedAt: Date.now(),
      });
    },
    [clearCountdown, dismiss],
  );

  const notify = useCallback(
    (input: NotificationInput): string => {
      sequence.current += 1;
      const id = `n${sequence.current}-${Date.now()}`;
      const tone = input.tone ?? 'info';
      const durationMs = input.durationMs === undefined ? DEFAULT_DURATION[tone] : input.durationMs;
      const notification: AppNotification = {
        id,
        title: input.title,
        description: input.description,
        action: input.action,
        tone,
        durationMs,
        createdAt: Date.now(),
        read: false,
        leaving: false,
      };

      setToasts((current) => {
        const next = [...current, notification];
        // Retire the surplus oldest toasts, cancelling their pending timers.
        const surplus = next.slice(0, Math.max(0, next.length - MAX_VISIBLE));
        surplus.forEach((toast) => clearCountdown(toast.id));
        return next.slice(-MAX_VISIBLE);
      });
      setHistory((current) => [notification, ...current].slice(0, MAX_HISTORY));

      if (durationMs !== null) startCountdown(id, durationMs);
      return id;
    },
    [clearCountdown, startCountdown],
  );

  const pauseTimers = useCallback(() => {
    setPaused(true);
    const now = Date.now();
    countdowns.current.forEach((countdown, id) => {
      clearTimeout(countdown.timeoutId);
      countdowns.current.set(id, {
        ...countdown,
        remaining: Math.max(0, countdown.remaining - (now - countdown.startedAt)),
      });
    });
  }, []);

  const resumeTimers = useCallback(() => {
    setPaused(false);
    const entries = [...countdowns.current.entries()];
    entries.forEach(([id, countdown]) => startCountdown(id, countdown.remaining));
  }, [startCountdown]);

  const markAllRead = useCallback(() => {
    setHistory((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  // Timers outlive React state, so they need an explicit teardown.
  useEffect(() => {
    const pending = countdowns.current;
    return () => {
      pending.forEach((countdown) => clearTimeout(countdown.timeoutId));
      pending.clear();
    };
  }, []);

  const unreadCount = useMemo(() => history.filter((item) => !item.read).length, [history]);

  const value = useMemo(
    () => ({
      toasts,
      history,
      unreadCount,
      paused,
      notify,
      dismiss,
      pauseTimers,
      resumeTimers,
      markAllRead,
      clearHistory,
    }),
    [
      toasts,
      history,
      unreadCount,
      paused,
      notify,
      dismiss,
      pauseTimers,
      resumeTimers,
      markAllRead,
      clearHistory,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
