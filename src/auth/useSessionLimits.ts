'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ABSOLUTE_LIMIT_MS,
  ACTIVITY_EVENTS,
  IDLE_LIMIT_MS,
  WARNING_BEFORE_MS,
  msUntil,
} from './session-limits';

interface Options {
  /** Sólo se vigila una sesión abierta. */
  active: boolean;
  /** Cerrar de verdad: lo hace `AuthProvider`, que sabe avisar al motor. */
  onExpire: () => void;
}

export interface SessionLimitsState {
  /** Segundos que faltan para el cierre, o `null` si aún no toca avisar. */
  secondsLeft: number | null;
  /** Por qué se va a cerrar, para poder decirlo con precisión. */
  cause: 'idle' | 'absolute' | null;
  /** «Sigo aquí»: reinicia la cuenta de inactividad. No burla el tope absoluto. */
  keepAlive: () => void;
  /**
   * Si el tope de inactividad ya venció. Lo consulta la renovación de token
   * antes de renovar: prolongar la sesión de una pestaña abandonada es
   * justamente lo que el tope existe para impedir.
   */
  idleExceeded: () => boolean;
}

/**
 * Vigila los dos topes de sesión y avisa antes de cerrar.
 *
 * La cuenta vive en refs y no en estado porque cada pulsación de tecla la
 * reinicia: guardarla en estado repintaría el portal entero mientras alguien
 * escribe. Sólo pasa a estado lo que se ve —los segundos del aviso—, y sólo
 * cuando el aviso está en pantalla.
 */
export function useSessionLimits({ active, onExpire }: Options): SessionLimitsState {
  const startedAt = useRef(Date.now());
  const lastActivity = useRef(Date.now());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [cause, setCause] = useState<'idle' | 'absolute' | null>(null);

  const keepAlive = useCallback(() => {
    lastActivity.current = Date.now();
    setSecondsLeft(null);
    setCause(null);
  }, []);

  // Una sesión nueva reinicia los dos relojes: iniciar sesión otra vez no puede
  // heredar la antigüedad de la anterior.
  useEffect(() => {
    if (!active) return;
    startedAt.current = Date.now();
    lastActivity.current = Date.now();
    setSecondsLeft(null);
    setCause(null);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onActivity = () => {
      // Ocultar la pestaña NO es actividad; volver a ella, sí.
      if (document.visibilityState === 'hidden') return;
      lastActivity.current = Date.now();
    };
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    /*
     * Se sondea cada segundo en vez de programar un `setTimeout` al vencimiento.
     * Un temporizador largo no sobrevive a la suspensión del equipo: al despertar
     * dispara tarde o no dispara, y una sesión que debía haber caducado durante
     * la noche seguiría viva. Comparar relojes en cada tic da el resultado
     * correcto aunque el navegador haya estado congelado seis horas.
     */
    const tick = window.setInterval(() => {
      const now = Date.now();
      const idleAt = lastActivity.current + IDLE_LIMIT_MS;
      const absoluteAt = startedAt.current + ABSOLUTE_LIMIT_MS;
      const deadline = Math.min(idleAt, absoluteAt);
      const remaining = msUntil(deadline, now);

      if (remaining === 0) {
        setSecondsLeft(null);
        setCause(null);
        onExpire();
        return;
      }
      if (remaining <= WARNING_BEFORE_MS) {
        setSecondsLeft(Math.ceil(remaining / 1000));
        setCause(idleAt <= absoluteAt ? 'idle' : 'absolute');
      } else if (secondsLeft !== null) {
        setSecondsLeft(null);
        setCause(null);
      }
    }, 1_000);
    return () => window.clearInterval(tick);
  }, [active, onExpire, secondsLeft]);

  const idleExceeded = useCallback(() => Date.now() - lastActivity.current >= IDLE_LIMIT_MS, []);

  return { secondsLeft, cause, keepAlive, idleExceeded };
}
