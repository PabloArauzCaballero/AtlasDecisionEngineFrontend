/**
 * Todos los recorridos posibles del árbol, del inicio a cada final.
 *
 * Un árbol de decisión se revisa preguntando «¿qué le pasa a cada tipo de caso?».
 * La lista de nodos no responde a eso: hay que seguir las flechas a ojo y es
 * justo donde se cuela la rama olvidada. Enumerar los caminos hace visible el
 * conjunto COMPLETO de posibilidades, que es lo que se audita.
 *
 * Es puro y determinista: mismo grafo, mismo orden, para que la revisión de dos
 * personas coincida y una prueba pueda fijarlo.
 */
import { asRows, display, type UnknownRecord } from '../../utils/records';

const TERMINAL_TYPES = new Set(['RESULT', 'END', 'MANUAL_REVIEW', 'ERROR']);

export interface FlowPath {
  /** Claves de nodo recorridas, del inicio al final. */
  nodes: string[];
  /** Etiqueta de cada bifurcación tomada, en orden. */
  branches: string[];
  /** Nodo donde termina, o `null` si el camino no llega a ninguno. */
  terminal: string | null;
  /** Un camino sin final es un agujero: la decisión se quedaría sin cerrar. */
  open: boolean;
}

/** Límite de seguridad: un grafo mal formado no debe colgar el editor. */
const MAX_PATHS = 200;

export function isTerminalNode(node: UnknownRecord): boolean {
  return Boolean(node.terminal) || TERMINAL_TYPES.has(display(node, 'type'));
}

export function enumeratePaths(nodes: UnknownRecord[], edges: UnknownRecord[]): FlowPath[] {
  const start = nodes.find((node) => display(node, 'type') === 'START');
  if (!start) return [];

  const byKey = new Map(nodes.map((node) => [display(node, 'key'), node]));
  const outgoing = new Map<string, UnknownRecord[]>();
  for (const edge of edges) {
    const from = display(edge, 'from');
    outgoing.set(from, [...(outgoing.get(from) ?? []), edge]);
  }
  // Orden estable: primero la prioridad declarada, luego la clave. Sin esto, dos
  // revisiones del mismo grafo listarían los caminos en orden distinto.
  for (const list of outgoing.values()) {
    list.sort(
      (a, b) =>
        Number(a.priority ?? 0) - Number(b.priority ?? 0) ||
        display(a, 'key').localeCompare(display(b, 'key')),
    );
  }

  const paths: FlowPath[] = [];

  const walk = (key: string, visited: string[], branches: string[]) => {
    if (paths.length >= MAX_PATHS) return;
    const node = byKey.get(key);
    if (!node) return;
    const trail = [...visited, key];

    if (isTerminalNode(node)) {
      paths.push({ nodes: trail, branches, terminal: key, open: false });
      return;
    }

    const next = outgoing.get(key) ?? [];
    if (!next.length) {
      // Ni es final ni sale de él ninguna flecha: el caso se queda sin respuesta.
      paths.push({ nodes: trail, branches, terminal: null, open: true });
      return;
    }

    for (const edge of next) {
      const to = display(edge, 'to');
      // Un ciclo se corta aquí: recorrerlo otra vez no añade posibilidades nuevas
      // y el validador ya lo reporta como error aparte.
      if (visited.includes(to)) continue;
      walk(to, trail, [...branches, branchLabel(edge)]);
    }
  };

  walk(display(start, 'key'), [], []);
  return paths;
}

/** Cómo se llama la rama que sale por esta flecha, en lenguaje del editor. */
function branchLabel(edge: UnknownRecord): string {
  if (edge.default) return 'si no se cumple';
  const condition = asRows(edge.conditions)[0];
  const code = condition ? display(condition, 'code') : '';
  return code && code !== '—' ? `si ${code}` : 'continuar';
}
