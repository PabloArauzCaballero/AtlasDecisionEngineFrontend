'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clamp } from '../../utils/numbers';

/**
 * Escala de un lienzo de grafo, compartida por todas las vistas que dibujan uno.
 *
 * Sólo el editor tenía zoom, y con botones propios cableados a su `useGraphEditor`. La
 * reproducción de una ejecución, el grafo en vivo, el historial de versiones y la vista
 * previa de un import se veían al 100 % o nada: un algoritmo de treinta pasos no cabía y
 * la única forma de verlo entero era el zoom del navegador, que encoge también el resto
 * del portal. Aquí la escala vive en un sitio y las cinco vistas la usan igual.
 *
 * ## Lo que hace que se sienta bien y no sólo «funcione»
 *
 * - **Ctrl/⌘ + rueda** amplía sobre el puntero, no sobre la esquina: el nodo que estabas
 *   mirando sigue debajo del cursor. Sin ese anclaje, cada paso de zoom te deja perdido en
 *   otra parte del grafo y acabas usando sólo los botones.
 * - **Ajustar** calcula la escala a la que el grafo entero cabe en la ventana. Es la
 *   respuesta a «¿por dónde voy?», que es distinta de «acércame un poco».
 * - **Arrastrar el fondo** desplaza el lienzo. Con zoom hay más mundo que pantalla, y
 *   buscar la barra de desplazamiento para moverte por un grafo es trabajo manual.
 *
 * La rueda SIN Ctrl se deja pasar a propósito: es el desplazamiento normal de la página y
 * secuestrarlo hace que la vista se «pegue» al pasar por encima con la rueda.
 */

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
/** Margen que deja «Ajustar» alrededor del grafo, para que no toque los bordes. */
const FIT_PADDING = 24;

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasZoom {
  zoom: number;
  /** Escala en porcentaje entero, que es como se enseña y se lee. */
  percent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Ajusta la escala para que el contenido entero quepa en la ventana visible. */
  fit: () => void;
  /** Se pone en el elemento con `overflow: auto` que enmarca el lienzo. */
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /** Se pone en el elemento escalado. Sirve para medirlo cuando no declara tamaño. */
  stageRef: React.RefObject<HTMLDivElement | null>;
  /** Tamaño del contenido SIN escalar, declarado o medido. `null` mientras no se sabe. */
  contentSize: CanvasSize | null;
  /** `true` mientras se arrastra el fondo, para cambiar el cursor. */
  panning: boolean;
}

interface Options {
  /**
   * Tamaño del contenido SIN escalar. Si se omite, se mide del propio DOM: las vistas con
   * un «mundo» de tamaño conocido (`canvas-world`) lo pasan, y las que crecen con su
   * contenido —el historial, la vista previa— se dejan medir.
   */
  content?: CanvasSize | null;
  /** Escala inicial y a la que vuelve «Restablecer». */
  initial?: number;
}

export function useCanvasZoom({ content = null, initial = 1 }: Options = {}): CanvasZoom {
  const [zoom, setZoom] = useState(initial);
  const [panning, setPanning] = useState(false);
  const [measured, setMeasured] = useState<CanvasSize | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  /**
   * Punto que hay que mantener quieto tras el próximo repintado.
   *
   * El scroll no se puede corregir en el mismo evento: el contenedor todavía tiene el
   * tamaño de la escala anterior, así que fijar `scrollLeft` ahí lo recorta al máximo
   * viejo. Se anota aquí y se aplica en el layout effect, ya con el tamaño nuevo.
   */
  const anchor = useRef<{ x: number; y: number; ratio: number } | null>(null);

  const applyZoom = useCallback((next: number, at?: { x: number; y: number }) => {
    setZoom((current) => {
      const target = clamp(round(next), ZOOM_MIN, ZOOM_MAX);
      if (target === current) return current;
      if (at) anchor.current = { x: at.x, y: at.y, ratio: target / current };
      return target;
    });
  }, []);

  // Reposiciona el scroll para que el punto anclado no se mueva bajo el puntero.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const pending = anchor.current;
    anchor.current = null;
    if (!viewport || !pending) return;
    viewport.scrollLeft = (viewport.scrollLeft + pending.x) * pending.ratio - pending.x;
    viewport.scrollTop = (viewport.scrollTop + pending.y) * pending.ratio - pending.y;
  }, [zoom]);

  // `preventDefault` sobre la rueda exige un listener no pasivo, y React los registra
  // pasivos: sin esto, Ctrl + rueda haría zoom del navegador Y del lienzo a la vez.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      applyZoom(zoom - Math.sign(event.deltaY) * ZOOM_STEP, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [applyZoom, zoom]);

  // Arrastre del fondo. Se ignora si el gesto empezó sobre un nodo o una arista: allí el
  // arrastre ya significa otra cosa (mover el nodo en el editor, o nada en las vistas de
  // sólo lectura, donde el clic abre el detalle).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let origin: { x: number; y: number; left: number; top: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (event.button !== 0 && event.button !== 1) return;
      if (target instanceof Element && target.closest('.graph-node, .graph-edges, button, a')) {
        return;
      }
      origin = {
        x: event.clientX,
        y: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      setPanning(true);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!origin) return;
      viewport.scrollLeft = origin.left - (event.clientX - origin.x);
      viewport.scrollTop = origin.top - (event.clientY - origin.y);
    };
    const stop = () => {
      origin = null;
      setPanning(false);
    };

    viewport.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      viewport.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  /**
   * Mide el contenido cuando no viene declarado. `ResizeObserver` informa de la caja de
   * DISEÑO, que no cambia con `transform`: por eso lo que se mide es el tamaño base y no
   * hay que deshacer la escala (ni entrar en un bucle midiendo lo que uno mismo escaló).
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (content || !stage || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setMeasured((current) =>
        current?.width === box.width && current?.height === box.height
          ? current
          : { width: box.width, height: box.height },
      );
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [content]);

  const contentSize = content ?? measured;

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !contentSize || contentSize.width <= 0 || contentSize.height <= 0) return;
    const available = {
      width: viewport.clientWidth - FIT_PADDING,
      height: viewport.clientHeight - FIT_PADDING,
    };
    if (available.width <= 0 || available.height <= 0) return;
    applyZoom(Math.min(available.width / contentSize.width, available.height / contentSize.height));
    viewport.scrollTo({ left: 0, top: 0 });
  }, [applyZoom, contentSize]);

  return {
    zoom,
    percent: Math.round(zoom * 100),
    canZoomIn: zoom < ZOOM_MAX,
    canZoomOut: zoom > ZOOM_MIN,
    zoomIn: () => applyZoom(zoom + ZOOM_STEP),
    zoomOut: () => applyZoom(zoom - ZOOM_STEP),
    reset: () => applyZoom(initial),
    fit,
    viewportRef,
    stageRef,
    contentSize,
    panning,
  };
}

/** Dos decimales: evita que 0.1 + 0.2 acabe enseñando «30.000000000000004 %». */
function round(value: number): number {
  return Number(value.toFixed(2));
}
