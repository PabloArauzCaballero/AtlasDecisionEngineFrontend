export interface AmbientNode {
  id: number;
  /** Posición en porcentaje del contenedor. */
  x: number;
  y: number;
  /** Anillo de retardo (1-3): desacompasa el latido para que la red parezca viva. */
  ring: 1 | 2 | 3;
  /** Los nodos "ancla" son algo mayores y sostienen la lectura de la red. */
  anchor?: boolean;
}

/**
 * Geometría de la red de fondo.
 *
 * Está escrita a mano en vez de generada al azar por dos razones: el resultado
 * debe leerse como un grafo de decisión —caminos que avanzan de izquierda a
 * derecha y se bifurcan— y debe ser idéntico en cada carga, porque un fondo que
 * cambia de forma al recargar se nota y distrae.
 *
 * La densidad es deliberadamente baja. Cada nodo y cada línea son elementos que
 * el navegador compone en cada fotograma; por encima de esta cantidad el fondo
 * empieza a competir con el contenido en lugar de acompañarlo.
 */
export const AMBIENT_NODES: readonly AmbientNode[] = [
  { id: 0, x: 6, y: 32, ring: 1, anchor: true },
  { id: 1, x: 17, y: 18, ring: 2 },
  { id: 2, x: 19, y: 55, ring: 3 },
  { id: 3, x: 30, y: 38, ring: 1, anchor: true },
  { id: 4, x: 32, y: 76, ring: 2 },
  { id: 5, x: 44, y: 22, ring: 3 },
  { id: 6, x: 47, y: 60, ring: 1 },
  { id: 7, x: 58, y: 41, ring: 2, anchor: true },
  { id: 8, x: 63, y: 84, ring: 3 },
  { id: 9, x: 72, y: 26, ring: 1 },
  { id: 10, x: 79, y: 62, ring: 2 },
  { id: 11, x: 88, y: 36, ring: 3, anchor: true },
  { id: 12, x: 93, y: 74, ring: 1 },
];

/** Aristas de la red, como pares de identificadores de nodo. */
export const AMBIENT_LINKS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 5],
  [3, 6],
  [4, 6],
  [5, 7],
  [6, 7],
  [6, 8],
  [7, 9],
  [7, 10],
  [8, 10],
  [9, 11],
  [10, 11],
  [10, 12],
];

/**
 * Camino que recorre el destello luminoso, de un extremo al otro de la red.
 *
 * Es el mismo gesto que hace la reproducción de una ejecución sobre el grafo
 * real: sugiere "aquí dentro fluyen decisiones" sin afirmar que haya ninguna en
 * curso —el fondo nunca simula actividad; el color de estado es lo único que
 * responde a lo que pasa de verdad—.
 */
export const AMBIENT_PULSE_PATH: readonly number[] = [0, 1, 3, 6, 7, 10, 11, 12];

/** Puntos del camino del destello, en coordenadas del `viewBox` de 100×100. */
export function pulsePoints(): string {
  return AMBIENT_PULSE_PATH.map((id) => {
    const node = AMBIENT_NODES[id];
    return `${node.x},${node.y}`;
  }).join(' ');
}
