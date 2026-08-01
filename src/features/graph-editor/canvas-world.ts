import { clamp } from '../../utils/numbers';
import type { UnknownRecord } from '../../utils/records';

/**
 * Geometría del lienzo del editor de grafos.
 *
 * Las coordenadas de un nodo son porcentajes (0–100) de un "mundo" en píxeles
 * mayor que el área visible: el contenedor muestra scroll vertical Y horizontal
 * de verdad, y el grafo se recorre en vez de verse apelmazado en una pantalla.
 */
export const NODE_WIDTH = 182;
export const NODE_HEIGHT = 66;
/**
 * Tamaño mínimo del "mundo" del lienzo en píxeles. Las coordenadas de los nodos
 * son porcentajes (0–100) de ese mundo, no del área visible: así el grafo tiene
 * siempre sitio de sobra y el contenedor muestra scroll vertical Y horizontal
 * reales en vez de apelmazar los nodos en la pantalla.
 */
const WORLD_WIDTH = 1680;
const WORLD_HEIGHT = 1020;
/** Tope para que un grafo degenerado no genere un lienzo imposible de recorrer. */
const WORLD_MAX_WIDTH = 7200;
const WORLD_MAX_HEIGHT = 4800;
/** Aire mínimo alrededor de cada tarjeta al calcular el tamaño del mundo. */
const NODE_GAP = 1.3;

/** Menor distancia (en %) entre dos coordenadas distintas de la lista. */
function smallestGap(values: number[]): number {
  const sorted = [...new Set(values.map((value) => +value.toFixed(2)))].sort((a, b) => a - b);
  let gap = 100;
  for (let index = 1; index < sorted.length; index += 1) {
    gap = Math.min(gap, sorted[index] - sorted[index - 1]);
  }
  return gap;
}

/**
 * El mundo crece con la densidad del grafo: si el layout tuvo que juntar las
 * columnas (muchos niveles) o las filas (muchas ramas), se ensancha el lienzo en
 * píxeles para que las tarjetas nunca se solapen — el usuario recorre el flujo
 * con el scroll en lugar de ver un amasijo.
 */
export function worldSize(positions: Array<{ x: number; y: number }>) {
  if (positions.length < 2) return { width: WORLD_WIDTH, height: WORLD_HEIGHT };
  const gapX = smallestGap(positions.map((position) => position.x));
  const gapY = smallestGap(positions.map((position) => position.y));
  return {
    width: clamp(
      gapX > 0 ? Math.ceil((NODE_WIDTH * NODE_GAP * 100) / gapX) : WORLD_WIDTH,
      WORLD_WIDTH,
      WORLD_MAX_WIDTH,
    ),
    height: clamp(
      gapY > 0 ? Math.ceil((NODE_HEIGHT * NODE_GAP * 100) / gapY) : WORLD_HEIGHT,
      WORLD_HEIGHT,
      WORLD_MAX_HEIGHT,
    ),
  };
}

export function positionOf(node: UnknownRecord, index: number) {
  const fallbackX = 8 + (index % 3) * 29;
  const fallbackY = 12 + Math.floor(index / 3) * 27;
  return {
    x: clamp(typeof node.x === 'number' ? node.x : fallbackX, 0, 96),
    y: clamp(typeof node.y === 'number' ? node.y : fallbackY, 0, 96),
  };
}
