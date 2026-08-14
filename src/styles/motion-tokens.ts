/**
 * Tokens de animación — única fuente de verdad para el movimiento del portal.
 *
 * `parts/motion.css` declara las mismas duraciones y curvas como variables CSS
 * (`--dur-fast`, `--ease-out`, …); este módulo las expone al código TypeScript
 * que necesita temporizar animaciones imperativas (reproducción de ejecuciones,
 * contadores animados, fondos reactivos). Los valores están duplicados a
 * propósito en los dos lenguajes, pero `motion-tokens.test.ts` verifica que no
 * se desincronicen.
 *
 * Regla del producto: esto es una consola de operaciones. La animación confirma
 * una acción, nunca la retrasa; por eso ninguna duración base supera 320 ms.
 */

export const motionTokens = {
  duration: {
    instant: 90,
    fast: 140,
    normal: 200,
    slow: 280,
    /** Sólo para recorridos explicativos (reproducción paso a paso). */
    deliberate: 900,
    /** Bucle de espera indeterminada (barra de una fila que se está clasificando). */
    loop: 1200,
  },
  /** Curvas como puntos de control, para animaciones por JS (Web Animations). */
  easing: {
    standard: [0.2, 0, 0, 1],
    enter: [0.16, 1, 0.3, 1],
    exit: [0.4, 0, 1, 1],
  },
  /** Curvas ya formateadas para `style.transition` / `animation-timing-function`. */
  css: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  /** Intensidad del desplazamiento en entradas y elevaciones (px). */
  travel: {
    subtle: 2,
    base: 8,
    lift: 16,
  },
} as const;

/** Velocidades del modo de reproducción, en multiplicadores sobre `deliberate`. */
export const playbackSpeeds = [
  { id: 'slow', label: 'Lenta', factor: 2 },
  { id: 'normal', label: 'Normal', factor: 1 },
  { id: 'fast', label: 'Rápida', factor: 0.45 },
  { id: 'step', label: 'Paso a paso', factor: 0 },
] as const;

export type PlaybackSpeedId = (typeof playbackSpeeds)[number]['id'];

/** Milisegundos por paso para una velocidad dada. `0` = avance manual. */
export function stepInterval(speed: PlaybackSpeedId): number {
  const found = playbackSpeeds.find((entry) => entry.id === speed) ?? playbackSpeeds[1];
  return Math.round(motionTokens.duration.deliberate * found.factor);
}

/**
 * Consulta puntual de `prefers-reduced-motion`. Para componentes usa
 * `useReducedMotion()`, que además reacciona a los cambios de preferencia.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Duración efectiva: devuelve 0 cuando el usuario pide movimiento reducido, de
 * modo que quien anima por JS cae en un cambio de estado instantáneo sin
 * duplicar la comprobación en cada componente.
 */
export function effectiveDuration(ms: number, reduced: boolean): number {
  return reduced ? 0 : ms;
}
