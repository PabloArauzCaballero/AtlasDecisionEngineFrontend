/**
 * Guía de configuración por tipo de nodo, para el botón de ayuda del panel.
 *
 * `node-catalog.ts` dice QUÉ es cada tipo y qué datos mueve —es la única verdad
 * de icono, forma y descripción—. Esto es lo otro que hace falta y no cabía allí:
 * CÓMO se configura, DE DÓNDE salen las piezas que pide y en qué se falla más.
 * Vive aparte para no engordar el catálogo, que ya alimenta el lienzo entero.
 */

export interface NodeTutorial {
  /** Pasos concretos para dejar el nodo funcionando. */
  steps: readonly string[];
  /** El error que se comete más a menudo con este tipo. */
  pitfall: string;
}

/** De dónde sale cada pieza que piden los nodos y las conexiones. */
export const CONDITION_ORIGIN =
  'Las condiciones NO son un catálogo global: pertenecen a este algoritmo. Se crean desde un nodo Condición o Switch (al elegir la variable que evalúan) y a partir de ahí se pueden reutilizar en cualquier conexión de este mismo grafo. La variable que comparan tiene que estar declarada arriba, en «Entradas · Variables a considerar».';

export const NODE_TUTORIALS: Readonly<Record<string, NodeTutorial>> = {
  START: {
    steps: [
      'No se configura: sólo puede haber uno y es por donde entra la decisión.',
      'Los datos que recibe son los declarados en «Entradas · Variables a considerar».',
      'Conéctalo al primer paso que deba evaluarse.',
    ],
    pitfall: 'Si una variable no está declarada como entrada, ningún paso podrá leerla.',
  },
  CONDITION: {
    steps: [
      'Elige la variable de entrada que quieres comparar.',
      'Define el operador y el valor: eso crea la condición de este algoritmo.',
      'Conecta DOS salidas: una «Cuando se cumple» y otra «Default / caso contrario».',
    ],
    pitfall:
      'Sin la rama por defecto, un caso que no cumpla la condición se queda sin camino y la decisión falla.',
  },
  SWITCH: {
    steps: [
      'Elige la variable que decide el reparto.',
      'Añade un caso por cada valor que quieras enrutar; cada uno crea su propia condición.',
      'Deja siempre una salida por defecto para los valores no contemplados.',
    ],
    pitfall: 'Dos casos que puedan cumplirse a la vez hacen la decisión no determinista.',
  },
  DECISION_TABLE: {
    steps: [
      'Declara las columnas de entrada y la de resultado.',
      'Añade una fila por regla; se aplica la PRIMERA que se cumple.',
      'Ordena de la más específica a la más general.',
    ],
    pitfall: 'Una fila general arriba tapa a todas las de abajo, que nunca llegan a evaluarse.',
  },
  EXPRESSION: {
    steps: [
      'Escribe el cálculo en JavaScript o Python (máximo 3 líneas ejecutables).',
      'Lee los datos desde `variables.<código>`, no desde `inputs`.',
      'Guarda el resultado en una variable intermedia o de salida.',
      'Si usas una función de librería, selecciónala: sin eso el guardado se rechaza.',
    ],
    pitfall:
      'Usar un nombre de variable que no está declarado como entrada: se detecta al validar, no al escribir.',
  },
  SCORE: {
    steps: [
      'Define el puntaje con código, igual que en Expresión.',
      'Declara el rango esperado en la variable donde lo guardas.',
      'Conecta las bandas de puntaje con nodos Condición.',
    ],
    pitfall: 'Un puntaje sin límites declarados deja pasar valores fuera de rango sin avisar.',
  },
  REFERENCE: {
    steps: [
      'Elige el algoritmo publicado al que quieres llamar.',
      'Mapea qué variables tuyas alimentan sus entradas.',
      'Mapea qué devuelve a tus variables intermedias o de salida.',
    ],
    pitfall:
      'Referenciar una versión sin compilar se rechaza: el algoritmo llamado debe estar compilado y disponible.',
  },
  MANUAL_REVIEW: {
    steps: [
      'Indica la cola o el equipo que recibirá el caso.',
      'Adjunta los motivos que expliquen por qué se deriva.',
      'Es un paso terminal: cierra el recorrido.',
    ],
    pitfall: 'Derivar sin motivos deja al analista sin contexto para decidir.',
  },
  ACTION: {
    steps: [
      'Elige la acción del catálogo del algoritmo (calcular un campo, emitir un motivo…).',
      'Si calcula un campo, las variables que consume deben estar declaradas como entrada.',
      'Conecta una única salida: una acción no bifurca el flujo.',
    ],
    pitfall:
      'Si la acción usa una variable que el árbol no declara, la validación lo bloquea antes de publicar.',
  },
  RESULT: {
    steps: [
      'Elige el valor de la decisión final.',
      'Adjunta los reason codes que la expliquen.',
      'Comprueba que cada campo del contrato de salida tenga origen declarado.',
    ],
    pitfall: 'Un resultado sin motivos no es explicable ante una reclamación.',
  },
  ERROR: {
    steps: [
      'Úsalo para el camino de fallo controlado.',
      'Deja escrito el motivo para que la traza lo muestre.',
    ],
    pitfall: 'Un error sin motivo obliga a reconstruir qué pasó desde los logs.',
  },
  END: {
    steps: [
      'Cierra un recorrido que no produce resultado de negocio.',
      'Todo camino del árbol debe terminar en un Fin o en un Resultado.',
    ],
    pitfall: 'Un camino sin final deja la decisión sin cerrar y la validación lo rechaza.',
  },
};

export function tutorialFor(nodeType: string): NodeTutorial | undefined {
  return NODE_TUTORIALS[nodeType];
}
