'use client';

import { useEffect, useState } from 'react';

/**
 * Preferencias y capacidades que deciden cuánta animación puede permitirse la
 * interfaz. Todos los hooks arrancan en el valor "seguro" (sin movimiento) para
 * que el HTML del servidor y el primer render del cliente coincidan: el valor
 * real se resuelve en un efecto, después de hidratar.
 */

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function subscribe(query: string, onChange: (value: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  let list: MediaQueryList;
  try {
    list = window.matchMedia(query);
  } catch {
    return () => {};
  }
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  onChange(list.matches);
  // Safari < 14 sólo expone la API antigua; sin este fallback el fondo se
  // quedaría congelado en su valor inicial en esos navegadores.
  if (typeof list.addEventListener === 'function') {
    list.addEventListener('change', listener);
    return () => list.removeEventListener('change', listener);
  }
  list.addListener(listener);
  return () => list.removeListener(listener);
}

/** `true` cuando el usuario pidió movimiento reducido en su sistema operativo. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => subscribe('(prefers-reduced-motion: reduce)', setReduced), []);
  return reduced;
}

/**
 * `true` mientras la pestaña está visible. Las animaciones en bucle se apagan
 * al pasar a segundo plano: no aportan nada y consumen batería.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

interface CapabilityHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

/**
 * Heurística de gama baja: poca memoria, pocos núcleos o una pantalla que el
 * navegador declara lenta de refrescar. En esos equipos los fondos animados se
 * sirven en su versión estática.
 */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const hints = navigator as Navigator & CapabilityHints;
  if (typeof hints.deviceMemory === 'number' && hints.deviceMemory > 0 && hints.deviceMemory <= 2) {
    return true;
  }
  if (typeof hints.hardwareConcurrency === 'number' && hints.hardwareConcurrency > 0) {
    if (hints.hardwareConcurrency <= 2) return true;
  }
  return matches('(update: slow)');
}

/**
 * Decisión única para cualquier superficie ambiental (fondos, partículas,
 * pulsos en bucle): sólo se anima con la pestaña visible, sin preferencia de
 * movimiento reducido y en un equipo capaz.
 */
export function useAmbientMotion(): boolean {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const [capable, setCapable] = useState(false);
  useEffect(() => setCapable(!isLowPowerDevice()), []);
  return capable && visible && !reduced;
}
