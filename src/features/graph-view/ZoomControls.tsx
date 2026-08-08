'use client';

import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { CanvasZoom } from './useCanvasZoom';

interface Props {
  zoom: CanvasZoom;
  /**
   * `floating` se ancla sobre el propio lienzo (vistas de sólo lectura, que no tienen
   * barra de herramientas); `inline` se integra en una que ya existe, como la del editor.
   */
  variant?: 'floating' | 'inline';
  label?: string;
  /**
   * «Ajustar» sólo tiene sentido sobre un lienzo con un mundo de tamaño propio dentro de
   * una ventana acotada. En un grafo de flujo —el historial de versiones, la vista previa
   * de un import— el contenido ya ocupa el ancho disponible y «ajustar» no significaría
   * nada: se omite el botón en vez de dejar uno que no hace nada visible.
   */
  showFit?: boolean;
}

/**
 * Controles de escala de un lienzo de grafo.
 *
 * El porcentaje es un BOTÓN, no una etiqueta: volver al 100 % es la acción que más se
 * repite después de explorar, y esconderla en un menú obliga a pulsar «alejar» siete
 * veces. «Ajustar» va aparte porque responde a otra pregunta —ver el grafo entero— y
 * mezclarla con el 100 % hacía que la gente creyera que el 100 % ya encajaba el grafo.
 */
export function ZoomControls({
  zoom,
  variant = 'floating',
  label = 'Escala del grafo',
  showFit = true,
}: Props) {
  return (
    <div className={`zoom-controls zoom-controls-${variant}`} role="group" aria-label={label}>
      <button
        type="button"
        className="icon-button"
        title="Alejar (Ctrl + rueda sobre el grafo)"
        aria-label="Alejar"
        disabled={!zoom.canZoomOut}
        onClick={zoom.zoomOut}
      >
        <ZoomOut size={15} />
      </button>
      <button
        type="button"
        className="zoom-value"
        title="Volver al 100 %"
        aria-label={`Escala ${zoom.percent} por ciento. Volver al 100 por ciento`}
        onClick={zoom.reset}
      >
        {zoom.percent}%
      </button>
      <button
        type="button"
        className="icon-button"
        title="Acercar (Ctrl + rueda sobre el grafo)"
        aria-label="Acercar"
        disabled={!zoom.canZoomIn}
        onClick={zoom.zoomIn}
      >
        <ZoomIn size={15} />
      </button>
      {showFit ? (
        <button
          type="button"
          className="icon-button"
          title="Ajustar el grafo entero a la ventana"
          aria-label="Ajustar el grafo a la ventana"
          onClick={zoom.fit}
        >
          <Maximize2 size={14} />
        </button>
      ) : null}
    </div>
  );
}
