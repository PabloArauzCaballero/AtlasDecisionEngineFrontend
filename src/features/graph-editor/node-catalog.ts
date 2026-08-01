import {
  Braces,
  Calculator,
  CircleDot,
  Flag,
  GitBranch,
  ListChecks,
  Network,
  ShieldAlert,
  Split,
  Square,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

/**
 * Lenguaje visual de los nodos del grafo.
 *
 * Un tipo de nodo no se distingue sólo por su color: cada uno declara además
 * icono, forma, etiqueta y una explicación en lenguaje llano. Así el grafo
 * sigue siendo legible en escala de grises, para quien no distingue colores y
 * en una captura impresa.
 *
 * `shape` se traduce en `parts/graph-node-language.css` a un recorte real del
 * contorno (rombo para las bifurcaciones, cápsula para los extremos, hexágono
 * para el código…), y `pattern` a una trama de fondo que refuerza la familia
 * del nodo sin depender del tono.
 */
export type NodeShape = 'capsule' | 'diamond' | 'hexagon' | 'card' | 'shield' | 'flag';
export type NodePattern = 'none' | 'dots' | 'lines' | 'grid';

export interface NodeTypeDefinition {
  icon: LucideIcon;
  /** Nombre legible del tipo, tal y como se muestra bajo el nombre del nodo. */
  label: string;
  /** Qué hace este paso, en una frase. Alimenta el tooltip del nodo. */
  description: string;
  /** Qué recibe y qué devuelve, para explicar el flujo de datos. */
  dataFlow: string;
  shape: NodeShape;
  pattern: NodePattern;
}

export const NODE_CATALOG = {
  START: {
    icon: CircleDot,
    label: 'Inicio',
    description: 'Punto único por el que entra la decisión.',
    dataFlow: 'Recibe las variables de entrada. No produce salida propia.',
    shape: 'capsule',
    pattern: 'none',
  },
  CONDITION: {
    icon: GitBranch,
    label: 'Condición',
    description: 'Divide el flujo en dos caminos según una regla.',
    dataFlow: 'Lee variables y elige la rama sí / no.',
    shape: 'diamond',
    pattern: 'lines',
  },
  SWITCH: {
    icon: Split,
    label: 'Bifurcación múltiple',
    description: 'Enruta el caso entre varias salidas según el valor de una variable.',
    dataFlow: 'Lee una variable y elige la rama del caso que coincide.',
    shape: 'diamond',
    pattern: 'lines',
  },
  DECISION_TABLE: {
    icon: ListChecks,
    label: 'Tabla de reglas',
    description: 'Evalúa una tabla de reglas y aplica la primera que se cumple.',
    dataFlow: 'Lee varias variables y devuelve el resultado de la fila que coincide.',
    shape: 'card',
    pattern: 'grid',
  },
  EXPRESSION: {
    icon: Braces,
    label: 'Expresión',
    description: 'Calcula un valor con código JavaScript o Python.',
    dataFlow: 'Lee las variables que usa el cálculo y escribe la variable destino.',
    shape: 'hexagon',
    pattern: 'dots',
  },
  SCORE: {
    icon: Calculator,
    label: 'Puntaje',
    description: 'Calcula un puntaje con código JavaScript o Python.',
    dataFlow: 'Lee las variables del modelo y escribe el puntaje resultante.',
    shape: 'hexagon',
    pattern: 'dots',
  },
  REFERENCE: {
    icon: Network,
    label: 'Algoritmo interno',
    description: 'Invoca otro algoritmo publicado y continúa con lo que devuelve.',
    dataFlow: 'Envía las variables mapeadas al algoritmo llamado y recibe sus salidas.',
    shape: 'card',
    pattern: 'grid',
  },
  MANUAL_REVIEW: {
    icon: ShieldAlert,
    label: 'Revisión manual',
    description: 'Deriva el caso a una persona en lugar de resolverlo automáticamente.',
    dataFlow: 'Recibe el caso y su evidencia; la salida la decide el analista.',
    shape: 'shield',
    pattern: 'lines',
  },
  ACTION: {
    icon: Square,
    label: 'Acción',
    description: 'Ejecuta un efecto del flujo sin bifurcarlo.',
    dataFlow: 'Lee variables del flujo y aplica la acción configurada.',
    shape: 'card',
    pattern: 'none',
  },
  RESULT: {
    icon: Flag,
    label: 'Resultado',
    description: 'Cierra el flujo con la decisión final y sus motivos.',
    dataFlow: 'Escribe las variables de salida que devuelve la decisión.',
    shape: 'flag',
    pattern: 'none',
  },
  ERROR: {
    icon: TriangleAlert,
    label: 'Error',
    description: 'Ruta de fallo: el motor no pudo completar la decisión por este camino.',
    dataFlow: 'Devuelve el detalle del error en lugar de un resultado de negocio.',
    shape: 'shield',
    pattern: 'lines',
  },
  END: {
    icon: CircleDot,
    label: 'Fin del flujo',
    description: 'Cierra el recorrido sin producir un resultado de negocio.',
    dataFlow: 'No escribe variables de salida.',
    shape: 'capsule',
    pattern: 'none',
  },
} as const satisfies Record<string, NodeTypeDefinition>;

export type NodeTypeKey = keyof typeof NODE_CATALOG;

const FALLBACK: NodeTypeDefinition = {
  icon: Square,
  label: 'Paso',
  description: 'Paso del algoritmo.',
  dataFlow: 'Configura las entradas que lee y las salidas que escribe.',
  shape: 'card',
  pattern: 'none',
};

/**
 * Definición de un tipo, tolerante a tipos que el backend añada más adelante:
 * un tipo desconocido cae en la tarjeta neutra en vez de romper el lienzo.
 */
export function nodeTypeDefinition(type: string): NodeTypeDefinition {
  return (NODE_CATALOG as Record<string, NodeTypeDefinition>)[type] ?? FALLBACK;
}

/** Etiqueta legible del tipo; `RESULT` → `Resultado`. */
export function nodeTypeLabel(type: string): string {
  return nodeTypeDefinition(type).label;
}

/**
 * Texto del tooltip del nodo: nombre, tipo, qué hace y cómo circulan los datos.
 * Es deliberadamente más que el nombre del nodo — repetirlo no explicaría nada.
 */
export function nodeTooltip(name: string, type: string): string {
  const definition = nodeTypeDefinition(type);
  return `${name} · ${definition.label}\n${definition.description}\n${definition.dataFlow}`;
}
