'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { NotificationContext } from './NotificationContext';
import {
  DEFAULT_DURATION,
  MAX_HISTORY,
  dedupeKeyFor,
  evictSurplus,
  findDuplicate,
} from './notification-queue';
import type { AppNotification, NotificationInput, NotificationPatch } from './notification.types';

/** Must match the exit animation in notifications.css. */
const EXIT_MS = 180;

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
  /**
   * Copia autoritativa de la pila visible.
   *
   * Fundir repeticiones y decidir a quién se sacrifica exige LEER la pila antes
   * de escribirla, y hacerlo dentro de un actualizador de `setState` obligaría a
   * lanzar temporizadores ahí dentro —efectos que React puede repetir—. Con la
   * referencia, la decisión se toma fuera y dos avisos levantados en el mismo
   * tick ven cada uno lo que dejó el anterior, cosa que el estado aún no refleja.
   */
  const visible = useRef<AppNotification[]>([]);
  const countdowns = useRef(new Map<string, Countdown>());
  /**
   * Temporizadores de salida en vuelo. Van aparte de `countdowns` porque no se
   * pausan al pasar el ratón, pero sí tienen que cancelarse al desmontar: si no,
   * disparan un `setState` sobre un provider que ya no existe.
   */
  const exits = useRef(new Set<ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);

  /** Única puerta de escritura de la pila: deja copia y estado a la par. */
  const commit = useCallback((next: AppNotification[]) => {
    visible.current = next;
    setToasts(next);
  }, []);

  const clearCountdown = useCallback((id: string) => {
    const countdown = countdowns.current.get(id);
    if (countdown) clearTimeout(countdown.timeoutId);
    countdowns.current.delete(id);
  }, []);

  /** Drops a toast from the DOM. Only ever called after the exit animation. */
  const remove = useCallback(
    (id: string) => {
      commit(visible.current.filter((toast) => toast.id !== id));
    },
    [commit],
  );

  /**
   * Starts the exit animation, then removes on a fixed timer rather than an
   * `animationend` listener — under reduced motion the animation is compressed
   * to ~0ms and the event can be missed, which would strand the toast.
   */
  const dismiss = useCallback(
    (id: string) => {
      clearCountdown(id);
      commit(
        visible.current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
      );
      const exitTimer = setTimeout(() => {
        exits.current.delete(exitTimer);
        remove(id);
      }, EXIT_MS);
      exits.current.add(exitTimer);
    },
    [clearCountdown, commit, remove],
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
      const now = Date.now();
      const tone = input.tone ?? 'info';
      const durationMs = input.durationMs === undefined ? DEFAULT_DURATION[tone] : input.durationMs;
      const dedupeKey = dedupeKeyFor(input, tone);

      /*
       * El mismo suceso otra vez no estrena tarjeta: se le sube el contador y se
       * le repone la cuenta atrás. Un backend caído contestaba a cada reintento
       * con un aviso nuevo, y cuatro copias del mismo fallo tapaban la pila
       * entera sin decir nada que la primera no dijera ya.
       */
      const duplicate = findDuplicate(visible.current, dedupeKey, now);
      if (duplicate) {
        const repeated = {
          ...duplicate,
          lastOccurredAt: now,
          repeatCount: duplicate.repeatCount + 1,
        };
        commit(visible.current.map((toast) => (toast.id === duplicate.id ? repeated : toast)));
        setHistory((current) =>
          current.map((item) =>
            item.id === duplicate.id ? { ...item, ...repeated, read: false } : item,
          ),
        );
        if (duplicate.durationMs !== null) startCountdown(duplicate.id, duplicate.durationMs);
        return duplicate.id;
      }

      sequence.current += 1;
      const id = `n${sequence.current}-${now}`;
      const notification: AppNotification = {
        id,
        title: input.title,
        description: input.description,
        action: input.action,
        tone,
        durationMs,
        progress: input.progress,
        dedupeKey,
        createdAt: now,
        lastOccurredAt: now,
        repeatCount: 1,
        read: false,
        leaving: false,
      };

      // Al recortar se sacrifica primero lo menos grave, no lo más antiguo.
      const { kept, evicted } = evictSurplus([...visible.current, notification]);
      evicted.forEach((toast) => clearCountdown(toast.id));
      commit(kept);
      setHistory((current) => [notification, ...current].slice(0, MAX_HISTORY));

      if (durationMs !== null) startCountdown(id, durationMs);
      return id;
    },
    [clearCountdown, commit, startCountdown],
  );

  /**
   * Retoca un aviso vivo en lugar de levantar otro: así una operación larga
   * cuenta su avance y su desenlace en la misma tarjeta que ya se está mirando.
   *
   * Nombrar un tono nuevo recalcula la duración —un «en curso» perpetuo que
   * termina en éxito tiene que aprender a marcharse solo— y da por cerrado el
   * avance, salvo que el propio retoque traiga uno.
   */
  const update = useCallback(
    (id: string, patch: NotificationPatch) => {
      const current = visible.current.find((toast) => toast.id === id);
      if (!current || current.leaving) return;

      const tone = patch.tone ?? current.tone;
      const durationMs =
        patch.durationMs !== undefined
          ? patch.durationMs
          : patch.tone
            ? DEFAULT_DURATION[patch.tone]
            : current.durationMs;
      const progress =
        patch.progress !== undefined ? patch.progress : patch.tone ? undefined : current.progress;

      const next: AppNotification = {
        ...current,
        title: patch.title ?? current.title,
        description: patch.description ?? current.description,
        action: patch.action ?? current.action,
        tone,
        durationMs,
        progress,
        lastOccurredAt: Date.now(),
      };

      commit(visible.current.map((toast) => (toast.id === id ? next : toast)));
      setHistory((entries) =>
        entries.map((item) => (item.id === id ? { ...item, ...next, read: false } : item)),
      );

      clearCountdown(id);
      if (durationMs !== null) startCountdown(id, durationMs);
    },
    [clearCountdown, commit, startCountdown],
  );

  /**
   * Congela las cuentas atrás. Tiene que ser idempotente: el visor pausa tanto
   * al entrar el ratón como al recibir el foco, y pasar el ratón por encima de
   * un aviso y luego tabular hasta él dispara las dos. Sin reponer `startedAt`,
   * la segunda pausa volvería a descontar el mismo tiempo transcurrido y el
   * aviso se desvanecería antes de que diera tiempo a leerlo.
   */
  const pauseTimers = useCallback(() => {
    setPaused(true);
    const now = Date.now();
    countdowns.current.forEach((countdown, id) => {
      clearTimeout(countdown.timeoutId);
      countdowns.current.set(id, {
        ...countdown,
        remaining: Math.max(0, countdown.remaining - (now - countdown.startedAt)),
        startedAt: now,
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
    const pendingExits = exits.current;
    return () => {
      pending.forEach((countdown) => clearTimeout(countdown.timeoutId));
      pending.clear();
      pendingExits.forEach((timer) => clearTimeout(timer));
      pendingExits.clear();
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
      update,
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
      update,
      dismiss,
      pauseTimers,
      resumeTimers,
      markAllRead,
      clearHistory,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
