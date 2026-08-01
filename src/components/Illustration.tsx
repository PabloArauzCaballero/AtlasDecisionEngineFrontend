import type { ReactNode } from 'react';

/**
 * Ilustraciones del sistema visual.
 *
 * Son SVG en línea, geométricos y dibujados con `currentColor`: heredan el
 * color del contenedor, así que funcionan igual en tema claro y oscuro sin
 * duplicar recursos. Al ir en línea no hay petición de red que bloquee la
 * interacción ni imágenes que optimizar, y escalan a cualquier tamaño.
 *
 * Cuando la ilustración sólo acompaña a un texto que ya explica la situación se
 * marca decorativa (`aria-hidden`); si comunica información propia recibe un
 * `alt` que se expone como nombre accesible.
 */

export type IllustrationName =
  'tests' | 'graph' | 'deploy' | 'learning' | 'success' | 'failure' | 'empty' | 'welcome';

interface IllustrationProps {
  name: IllustrationName;
  /** Texto alternativo. Si se omite, la ilustración es decorativa. */
  alt?: string;
  size?: number;
}

export function Illustration({ name, alt, size = 132 }: IllustrationProps) {
  const accessibility = alt
    ? ({ role: 'img', 'aria-label': alt } as const)
    : ({ 'aria-hidden': true } as const);
  return (
    <svg
      className={`illustration illustration-${name}`}
      viewBox="0 0 160 120"
      width={size}
      height={(size * 120) / 160}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...accessibility}
    >
      {SHAPES[name]}
    </svg>
  );
}

/** Malla de fondo común: sitúa cada escena sobre la misma cuadrícula técnica. */
const grid: ReactNode = (
  <g className="illustration-grid" strokeWidth={1}>
    <path d="M12 96h136" />
    <path d="M12 24v72" />
  </g>
);

const SHAPES: Record<IllustrationName, ReactNode> = {
  tests: (
    <>
      {grid}
      <path
        className="illustration-accent"
        d="M62 28v22L44 84a8 8 0 0 0 7 12h58a8 8 0 0 0 7-12L98 50V28"
      />
      <path d="M56 28h48" />
      <path className="illustration-soft" d="M53 68h54" />
      <circle className="illustration-accent" cx="70" cy="80" r="4" />
      <circle className="illustration-accent" cx="90" cy="86" r="3" />
      <circle cx="82" cy="72" r="2" />
    </>
  ),
  graph: (
    <>
      {grid}
      <rect className="illustration-accent" x="20" y="48" width="34" height="22" rx="6" />
      <rect x="66" y="22" width="34" height="22" rx="6" />
      <rect x="66" y="74" width="34" height="22" rx="6" />
      <rect className="illustration-accent" x="112" y="48" width="30" height="22" rx="6" />
      <path className="illustration-soft" d="M54 56h6a6 6 0 0 0 6-6v-5M54 62h6a6 6 0 0 1 6 6v9" />
      <path className="illustration-soft" d="M100 33h6a6 6 0 0 1 6 6v9M100 85h6a6 6 0 0 0 6-6v-9" />
    </>
  ),
  deploy: (
    <>
      {grid}
      <path
        className="illustration-accent"
        d="M46 74a16 16 0 0 1 2-32 24 24 0 0 1 46-4 18 18 0 0 1 4 36z"
      />
      <path d="M80 66v28" />
      <path className="illustration-accent" d="M70 84l10 10 10-10" />
      <path className="illustration-soft" d="M40 96h80" />
    </>
  ),
  learning: (
    <>
      {grid}
      <path className="illustration-accent" d="M24 44l56-22 56 22-56 22z" />
      <path d="M44 54v24c0 8 16 14 36 14s36-6 36-14V54" />
      <path className="illustration-soft" d="M136 44v26" />
      <circle className="illustration-accent" cx="136" cy="74" r="4" />
    </>
  ),
  success: (
    <>
      {grid}
      <circle className="illustration-accent" cx="80" cy="58" r="30" />
      <path d="M66 58l10 11 20-23" />
      <path className="illustration-soft" d="M34 96h92" />
      <path className="illustration-soft" d="M118 30l6-8M126 44l10-4" />
    </>
  ),
  failure: (
    <>
      {grid}
      <path className="illustration-accent" d="M80 26l32 56H48z" />
      <path d="M80 48v16" />
      <circle cx="80" cy="72" r="2.4" fill="currentColor" />
      <path className="illustration-soft" d="M34 96h92" />
    </>
  ),
  empty: (
    <>
      {grid}
      <rect className="illustration-accent" x="34" y="32" width="92" height="56" rx="8" />
      <path className="illustration-soft" d="M34 50h92" />
      <path className="illustration-soft" d="M50 64h34M50 76h54" />
      <circle cx="44" cy="41" r="2.4" fill="currentColor" />
    </>
  ),
  welcome: (
    <>
      {grid}
      <circle className="illustration-accent" cx="80" cy="58" r="26" />
      <path d="M80 32v52M54 58h52" />
      <path className="illustration-soft" d="M62 40a34 34 0 0 0 0 36M98 40a34 34 0 0 1 0 36" />
      <circle
        className="illustration-accent"
        cx="80"
        cy="58"
        r="5"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
};
