import { useRef } from 'react';
import type { PointerEvent as PunteroEvento } from 'react';
import { areaVisibleDeImagen, type Seleccion } from './imagen-edicion';

/**
 * La imagen con un rectángulo que se arrastra encima.
 *
 * La selección se guarda en fracciones del ÁREA REAL de la imagen —no de la caja, que con
 * `object-fit: contain` tiene bandas vacías a los lados—, de modo que el recorte cae sobre píxeles
 * de la imagen sin importar el tamaño en pantalla.
 */
export function ZonaDeRecorte({
  url,
  alt,
  seleccion,
  onSeleccion,
}: Readonly<{
  url: string;
  alt: string;
  seleccion: Seleccion | null;
  onSeleccion: (valor: Seleccion | null) => void;
}>) {
  const caja = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLImageElement>(null);
  const arrastrando = useRef(false);

  const area = () => {
    const nodoCaja = caja.current;
    const nodoImagen = imagen.current;
    if (!nodoCaja || !nodoImagen || !nodoImagen.naturalWidth) return null;
    const medidas = nodoCaja.getBoundingClientRect();
    return {
      medidas,
      visible: areaVisibleDeImagen(
        { ancho: medidas.width, alto: medidas.height },
        { ancho: nodoImagen.naturalWidth, alto: nodoImagen.naturalHeight },
      ),
    };
  };

  const punto = (evento: PunteroEvento) => {
    const datos = area();
    if (!datos) return null;
    const { medidas, visible } = datos;
    const limitar = (valor: number) => Math.max(0, Math.min(1, valor));
    return {
      x: limitar((evento.clientX - medidas.left - visible.x) / visible.ancho),
      y: limitar((evento.clientY - medidas.top - visible.y) / visible.alto),
    };
  };

  const datos = area();
  const marco =
    seleccion && datos
      ? {
          left: datos.visible.x + Math.min(seleccion.x0, seleccion.x1) * datos.visible.ancho,
          top: datos.visible.y + Math.min(seleccion.y0, seleccion.y1) * datos.visible.alto,
          width: Math.abs(seleccion.x1 - seleccion.x0) * datos.visible.ancho,
          height: Math.abs(seleccion.y1 - seleccion.y0) * datos.visible.alto,
        }
      : null;

  return (
    <div
      ref={caja}
      className="case-carousel__crop"
      onPointerDown={(evento) => {
        const inicio = punto(evento);
        if (!inicio) return;
        evento.currentTarget.setPointerCapture(evento.pointerId);
        arrastrando.current = true;
        onSeleccion({ x0: inicio.x, y0: inicio.y, x1: inicio.x, y1: inicio.y });
      }}
      onPointerMove={(evento) => {
        if (!arrastrando.current || !seleccion) return;
        const actual = punto(evento);
        if (actual) onSeleccion({ ...seleccion, x1: actual.x, y1: actual.y });
      }}
      onPointerUp={() => {
        arrastrando.current = false;
      }}
    >
      <img ref={imagen} src={url} alt={alt} draggable={false} />
      {marco ? <div className="case-carousel__crop-box" style={marco} /> : null}
    </div>
  );
}
