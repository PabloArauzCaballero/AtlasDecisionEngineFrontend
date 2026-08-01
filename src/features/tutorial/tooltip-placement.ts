export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Placement {
  top: number;
  left: number;
  /** Lado elegido; el overlay lo usa para dibujar la flecha. */
  side: 'below' | 'above' | 'right' | 'left';
}

/** Aire entre la tarjeta y el elemento resaltado, y entre la tarjeta y el borde. */
const GAP = 14;
const MARGIN = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sitúa la tarjeta del tutorial junto al elemento resaltado.
 *
 * Antes se colocaba siempre debajo y se recortaba su posición asumiendo una
 * altura fija de 240 px. Cualquier paso con texto largo o con consejo se salía
 * por abajo de la pantalla y quedaba cortado —el usuario no veía ni el botón de
 * "Siguiente"—. Ahora se mide la tarjeta de verdad y se elige el primer lado
 * donde entra completa: debajo, encima, a la derecha o a la izquierda.
 *
 * Si no cabe en ningún lado (pantallas muy pequeñas), se encaja dentro de la
 * ventana igualmente: la hoja de estilos le pone altura máxima con scroll, así
 * que el contenido sigue siendo alcanzable.
 */
export function placeTooltip(target: Box, card: Box, viewport: { width: number; height: number }) {
  const maxLeft = Math.max(MARGIN, viewport.width - card.width - MARGIN);
  const maxTop = Math.max(MARGIN, viewport.height - card.height - MARGIN);

  const below = target.top + target.height + GAP;
  const above = target.top - card.height - GAP;
  const rightOf = target.left + target.width + GAP;
  const leftOf = target.left - card.width - GAP;

  // Alineada al borde del elemento, pero sin salirse de la ventana.
  const alignedLeft = clamp(target.left, MARGIN, maxLeft);
  const alignedTop = clamp(target.top, MARGIN, maxTop);

  if (below + card.height + MARGIN <= viewport.height) {
    return { top: below, left: alignedLeft, side: 'below' as const };
  }
  if (above >= MARGIN) {
    return { top: above, left: alignedLeft, side: 'above' as const };
  }
  if (rightOf + card.width + MARGIN <= viewport.width) {
    return { top: alignedTop, left: rightOf, side: 'right' as const };
  }
  if (leftOf >= MARGIN) {
    return { top: alignedTop, left: leftOf, side: 'left' as const };
  }
  // Sin sitio a los lados: se centra verticalmente dentro de lo que hay.
  return {
    top: clamp(below, MARGIN, maxTop),
    left: alignedLeft,
    side: 'below' as const,
  };
}
