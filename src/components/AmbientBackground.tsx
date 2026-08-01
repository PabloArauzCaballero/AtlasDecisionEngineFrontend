'use client';

import { useEffect, useRef } from 'react';
import { useAmbientMotion } from '../hooks/useMotionPreferences';
import { AMBIENT_LINKS, AMBIENT_NODES, pulsePoints } from './ambient-network';

export type AmbientVariant = 'auth' | 'dashboard' | 'lab' | 'editor' | 'results' | 'deploy';
export type AmbientState = 'idle' | 'running' | 'success' | 'warning' | 'error';

interface AmbientBackgroundProps {
  variant?: AmbientVariant;
  /** Estado real de la plataforma; tiñe el fondo sin cambiar su geometría. */
  state?: AmbientState;
  /** Sigue suavemente al cursor. Se ignora en táctil y en gama baja. */
  interactive?: boolean;
}

/**
 * Fondo ambiental: aurora, haz de luz, malla técnica y una red de nodos
 * conectados con un destello que la recorre.
 *
 * Todo se resuelve con degradados, SVG y `transform`/`opacity` —las dos
 * propiedades que el navegador compone en la GPU sin recalcular diseño—; no hay
 * canvas, ni WebGL, ni bucle de dibujo. Las capas se desplazan con el cursor a
 * ritmos distintos, y de ese desfase sale la sensación de profundidad.
 *
 * Contraste: una viñeta final oscurece los bordes y aclara el centro, de modo
 * que las superficies con texto quedan sobre la zona más calmada del fondo.
 *
 * Se apaga solo cuando la pestaña deja de estar visible, cuando el equipo
 * declara gama baja y cuando el usuario pide movimiento reducido; entonces
 * queda la versión estática, que conserva color y composición pero no se mueve.
 * Siempre va detrás del contenido (`aria-hidden`, sin eventos de puntero).
 */
export function AmbientBackground({
  variant = 'dashboard',
  state = 'idle',
  interactive = true,
}: AmbientBackgroundProps) {
  const host = useRef<HTMLDivElement>(null);
  const animated = useAmbientMotion();

  useEffect(() => {
    const element = host.current;
    if (!element || !animated || !interactive) return;
    // Un puntero grueso (dedo) no tiene posición de reposo: seguirlo produce
    // saltos, así que la reacción al cursor sólo se activa con ratón o lápiz.
    const finePointer =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    if (!finePointer) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;
    const apply = () => {
      frame = 0;
      if (!pending) return;
      // Se publican dos formas de la misma posición: la absoluta (0…1), que usa
      // el foco de luz para ir exactamente donde está el cursor, y el desvío
      // respecto al centro (-0.5…0.5), que cada capa multiplica por su propio
      // factor para separarse en profundidad.
      element.style.setProperty('--ambient-px', pending.x.toFixed(4));
      element.style.setProperty('--ambient-py', pending.y.toFixed(4));
      element.style.setProperty('--ambient-x', (pending.x - 0.5).toFixed(4));
      element.style.setProperty('--ambient-y', (pending.y - 0.5).toFixed(4));
      pending = null;
    };
    // Un único listener global, agrupado en rAF: el trabajo por movimiento es
    // escribir cuatro variables CSS, nunca un relayout.
    const onMove = (event: PointerEvent) => {
      pending = {
        x: event.clientX / Math.max(1, window.innerWidth),
        y: event.clientY / Math.max(1, window.innerHeight),
      };
      if (!frame) frame = requestAnimationFrame(apply);
    };
    // Al salir el puntero de la ventana la luz vuelve al centro en lugar de
    // quedarse clavada en el borde, que se lee como que algo se atascó.
    const onLeave = () => {
      pending = { x: 0.5, y: 0.4 };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [animated, interactive]);

  /**
   * El fondo también responde al desplazamiento: al leer una página larga las
   * capas se desfasan, así que el movimiento propio de la lectura produce
   * profundidad sin que haga falta mover el ratón (y funciona en táctil).
   */
  useEffect(() => {
    const element = host.current;
    if (!element || !animated) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const total = Math.max(1, document.body.scrollHeight - window.innerHeight);
      element.style.setProperty('--ambient-scroll', (window.scrollY / total).toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [animated]);

  /**
   * Onda al pulsar: una única circunferencia que se expande desde el punto del
   * clic y se retira sola al terminar su animación.
   *
   * Es la reacción más directa que puede dar un fondo —confirma que el gesto
   * llegó— y cuesta un elemento efímero. Se limita a una onda viva a la vez:
   * pulsar rápido no debe acumular capas animándose.
   */
  useEffect(() => {
    const element = host.current;
    if (!element || !animated || !interactive) return;
    const onDown = (event: PointerEvent) => {
      element.querySelector('.ambient-ripple')?.remove();
      const ripple = document.createElement('span');
      ripple.className = 'ambient-ripple';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      element.append(ripple);
    };
    window.addEventListener('pointerdown', onDown, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onDown);
      // Las ondas se añaden al DOM fuera de React; hay que retirarlas a mano o
      // quedarían huérfanas si el fondo se desmonta a mitad de la animación.
      element.querySelectorAll('.ambient-ripple').forEach((node) => node.remove());
    };
  }, [animated, interactive]);

  return (
    <div
      ref={host}
      className={`ambient-bg ambient-${variant} ${animated ? 'is-animated' : 'is-static'}`}
      data-state={state}
      aria-hidden="true"
    >
      {/* Tres manchas de luz independientes, cada una con su propio recorrido y
          su propio periodo. Es lo que hace que el fondo respire por su cuenta:
          como los periodos no son múltiplos entre sí, la composición tarda horas
          en repetirse y nunca se percibe el bucle. */}
      <span className="ambient-aurora">
        <i data-blob="1" />
        <i data-blob="2" />
        <i data-blob="3" />
      </span>
      {/* Foco que sigue al cursor: la luz va exactamente donde está la mano, que
          es lo que hace que el fondo se perciba reactivo y no sólo animado. */}
      <span className="ambient-spotlight" />
      <span className="ambient-beam" />
      <span className="ambient-grid" />
      <span className="ambient-network">
        {/* Las líneas van en SVG estirado al contenedor: una línea no sufre por
            deformarse y el trazo se mantiene fino gracias a `non-scaling-stroke`.
            Los nodos siguen siendo elementos HTML para conservarse redondos. */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <g className="ambient-links">
            {AMBIENT_LINKS.map(([from, to]) => (
              <line
                key={`${from}-${to}`}
                x1={AMBIENT_NODES[from].x}
                y1={AMBIENT_NODES[from].y}
                x2={AMBIENT_NODES[to].x}
                y2={AMBIENT_NODES[to].y}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <polyline
            className="ambient-pulse"
            points={pulsePoints()}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {AMBIENT_NODES.map((node) => (
          <i
            key={node.id}
            className={node.anchor ? 'is-anchor' : undefined}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            data-ring={node.ring}
          />
        ))}
      </span>
      <span className="ambient-vignette" />
    </div>
  );
}
