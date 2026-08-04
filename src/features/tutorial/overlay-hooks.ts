'use client';

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { placeTooltip, type Placement } from './tooltip-placement';

/**
 * `true` cuando el elemento del paso existe pero no se puede accionar.
 *
 * Un botón deshabilitado —"Guardar" sin cambios, "Ejecutar" sin versión— nunca
 * emitirá el clic que el paso espera. Detectarlo permite ofrecer "Siguiente" en
 * lugar de dejar al usuario mirando un botón que no responde.
 */
export function useTargetDisabled(selector: string | undefined, rect: DOMRect | null): boolean {
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (!selector) {
      setDisabled(false);
      return;
    }
    const element = document.querySelector(selector);
    setDisabled(
      element instanceof HTMLElement &&
        (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true'),
    );
    // `rect` cambia cuando el elemento aparece o se mueve: es la señal de que
    // toca volver a mirar si sigue deshabilitado.
  }, [selector, rect]);

  return disabled;
}

/**
 * Calcula dónde va la tarjeta midiéndola de verdad.
 *
 * Se mide en `useLayoutEffect` y antes de pintar, así que el usuario no llega a
 * ver la tarjeta en una posición provisional. El `ResizeObserver` la recoloca
 * cuando su contenido cambia de alto —pasos con consejo, textos largos, la
 * pregunta de salida— sin esperar a un cambio de paso.
 */
export function usePlacement(
  card: RefObject<HTMLDivElement | null>,
  rect: DOMRect | null,
): Placement | null {
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const element = card.current;
    if (!rect || !element) {
      setPlacement(null);
      return;
    }
    const reposition = () => {
      const box = element.getBoundingClientRect();
      setPlacement(
        placeTooltip(
          { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          { top: 0, left: 0, width: box.width, height: box.height },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    };
    reposition();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(reposition);
    observer.observe(element);
    return () => observer.disconnect();
  }, [card, rect]);

  return placement;
}
