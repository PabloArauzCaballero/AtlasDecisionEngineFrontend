'use client';

import type { ReactNode } from 'react';
import { useCanvasZoom } from './useCanvasZoom';
import { ZoomControls } from './ZoomControls';

interface Props {
  children: ReactNode;
  label: string;
  /** Clase del marco, para que cada vista conserve su altura y su fondo. */
  className?: string;
}

/**
 * Escala un grafo que NO tiene un mundo de tamaño fijo, sino que crece con su contenido:
 * el historial de versiones y la vista previa de un import.
 *
 * La diferencia con el lienzo del editor está en cómo se reserva el sitio. Allí el mundo
 * mide lo que mide y basta multiplicarlo por la escala. Aquí el contenido es un bloque de
 * flujo normal, y `transform` NO cambia la caja de diseño: al escalar, el contenedor
 * seguiría creyendo que mide lo de antes y recortaría o dejaría un hueco. Por eso el
 * ancho del escenario se compensa (`100 / zoom %`, que escalado vuelve a dar el 100 %) y
 * la altura del hueco se calcula con la altura medida por el hook.
 */
export function ZoomableFlow({ children, label, className = '' }: Props) {
  const zoom = useCanvasZoom();
  const height = zoom.contentSize ? zoom.contentSize.height * zoom.zoom : undefined;

  return (
    <div className={`zoom-flow ${className}`.trim()}>
      <ZoomControls zoom={zoom} label={label} showFit={false} />
      <div
        className={`zoom-flow-viewport ${zoom.panning ? 'is-panning' : ''}`.trim()}
        ref={zoom.viewportRef}
        aria-label={label}
      >
        {/* `is-measured` saca el escenario del flujo y deja mandar a la altura calculada.
            Hasta que hay medida —el primer pintado, o un navegador sin `ResizeObserver`—
            el escenario sigue en flujo y la vista se ve exactamente como antes de existir
            el zoom, en vez de colapsar a un hueco de altura cero. */}
        <div
          className={`zoom-flow-spacer ${height === undefined ? '' : 'is-measured'}`.trim()}
          style={{ height }}
        >
          <div
            className="zoom-flow-stage"
            ref={zoom.stageRef}
            style={{ transform: `scale(${zoom.zoom})`, width: `${100 / zoom.zoom}%` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
