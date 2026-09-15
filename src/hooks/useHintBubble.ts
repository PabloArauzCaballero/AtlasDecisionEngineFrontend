'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Posicionamiento de los globos de ayuda (`Tooltip`, `InfoHint`).
 *
 * El globo vivía como absoluto DENTRO de su disparador, y eso lo condenaba dos
 * veces: un ancestro con `overflow` lo recortaba, y ningún `z-index` podía
 * sacarlo del contexto de apilamiento donde naciera — cerca de la barra
 * superior pegajosa o de la cabecera fija de una tabla, el globo se abría y
 * quedaba tapado. Es la misma trampa que ya expulsó a los modales del árbol de
 * la ruta (ver `ModalDialog.tsx`): aquí el globo se monta en `document.body` y
 * este hook le calcula coordenadas fijas al abrirse.
 *
 * Reglas de colocación, medidas contra la ventana y no contra contenedores:
 * - Arriba del disparador si cabe; abajo si no (`data-placement` lo publica
 *   para que la flecha y la animación de entrada sigan al lado real).
 * - Sujeto a los bordes laterales: sustituye las listas de contenedores
 *   «anclados a la derecha» que crecían con cada medición nueva.
 * - En pantallas estrechas no escribe coordenadas: `hint-bubbles-narrow.css`
 *   acopla el globo al pie de la ventana, que es el único ancho que siempre
 *   cabe.
 */

/** Separación entre disparador y globo, la que ya usaban las hojas. */
const GAP = 7;
/** Aire mínimo contra los bordes de la ventana (el mínimo de `--gutter`). */
const EDGE = 16;
/** El mismo umbral que `hint-bubbles-narrow.css`. */
const NARROW_QUERY = '(max-width: 820px)';

export type BubblePlacement = 'above' | 'below';

/**
 * `forceOpen` abre la burbuja desde fuera: el campo asociado tiene el foco. Quien
 * tabula por un formulario nunca pasa por el icono ⓘ, así que sin esto la ayuda
 * de un campo sólo existía para quien la busca con el ratón.
 */
export function useHintBubble(forceOpen?: boolean) {
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Escape cierra sin mover el ratón (WCAG 1.4.13) incluso con el campo
  // enfocado: `dismissed` se rearma en cuanto el foco sale del campo.
  const open = hovered || (Boolean(forceOpen) && !dismissed);
  const [placement, setPlacement] = useState<BubblePlacement>('above');

  const position = useCallback(() => {
    const wrap = wrapRef.current;
    const bubble = bubbleRef.current;
    if (!wrap || !bubble) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches) {
      // El globo se acopla al pie por CSS; unas coordenadas en línea lo pisarían.
      bubble.style.removeProperty('--bubble-top');
      bubble.style.removeProperty('--bubble-left');
      bubble.style.removeProperty('--bubble-arrow-x');
      return;
    }
    const anchor = wrap.getBoundingClientRect();
    // El globo está siempre montado (opacidad 0), así que se puede medir con su
    // ancho natural antes de colocarlo.
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;
    const above = anchor.top - GAP - height >= EDGE;
    const top = above ? anchor.top - GAP - height : anchor.bottom + GAP;
    const left = Math.min(
      Math.max(anchor.left + anchor.width / 2 - width / 2, EDGE),
      Math.max(window.innerWidth - EDGE - width, EDGE),
    );
    // La flecha apunta al centro del disparador aunque el globo esté sujeto a
    // un borde; los topes evitan que se salga del radio de la esquina.
    const arrowX = Math.min(Math.max(anchor.left + anchor.width / 2 - left, 12), width - 12);
    bubble.style.setProperty('--bubble-top', `${Math.round(top)}px`);
    bubble.style.setProperty('--bubble-left', `${Math.round(left)}px`);
    bubble.style.setProperty('--bubble-arrow-x', `${Math.round(arrowX)}px`);
    setPlacement(above ? 'above' : 'below');
  }, []);

  // Colocar ANTES de abrir: la aparición es un fundido y el primer fotograma ya
  // debe estar en su sitio, no viajando desde la posición aparcada.
  const show = useCallback(() => {
    position();
    setHovered(true);
    setDismissed(false);
  }, [position]);
  const hide = useCallback(() => setHovered(false), []);

  // Colocar también cuando la abre el foco del control, no el ratón.
  useEffect(() => {
    if (forceOpen) {
      setDismissed(false);
      position();
    }
  }, [forceOpen, position]);

  useEffect(() => {
    if (!open) return;
    // `capture` porque el scroll de un panel interior no burbujea hasta window.
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setHovered(false);
      setDismissed(true);
    };
    // Poder retirar el globo sin mover el puntero (WCAG 1.4.13).
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, position]);

  return { wrapRef, bubbleRef, open, placement, show, hide };
}
