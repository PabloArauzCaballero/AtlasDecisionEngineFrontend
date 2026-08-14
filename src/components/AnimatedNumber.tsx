'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useMotionPreferences';
import { formatNumber } from '../config/locale';

interface AnimatedNumberProps {
  value: number;
  /** Sufijo pegado al número, p. ej. ' %' o ' ms'. */
  suffix?: string;
  /** Decimales a mostrar. */
  decimals?: number;
  /** Duración del conteo en ms. Se ignora con movimiento reducido. */
  duration?: number;
}

/**
 * Contador que sube hasta su valor real al aparecer.
 *
 * Reglas del producto: llega rápido al valor de verdad (≤ 700 ms), no repite la
 * animación si el dato refresca con el mismo número y se salta por completo el
 * conteo con `prefers-reduced-motion`. El valor final se expone siempre al
 * lector de pantalla, que nunca oye las cifras intermedias.
 */
export function AnimatedNumber({
  value,
  suffix = '',
  decimals = 0,
  duration = 620,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduced || !Number.isFinite(value) || start === value) {
      setShown(value);
      return;
    }
    let frame = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / duration);
      // Curva de salida: casi todo el recorrido ocurre al principio, así el
      // número se lee de verdad mucho antes de que termine la animación.
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(start + (value - start) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reduced, value]);

  const format = (input: number) =>
    `${formatNumber(input, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

  return (
    <span className="animated-number">
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
