/**
 * Guía de configuración por tipo de nodo, para el botón de ayuda del panel.
 *
 * `node-catalog.ts` dice QUÉ es cada tipo y qué datos mueve —es la única verdad
 * de icono, forma y descripción—. Esto es lo otro que hace falta y no cabía allí:
 * CÓMO se configura, DE DÓNDE salen las piezas que pide y en qué se falla más.
 * Vive aparte para no engordar el catálogo, que ya alimenta el lienzo entero.
 *
 * ## Qué le faltaba
 *
 * Eran unos pasos y un aviso. Servía para quien ya sabía lo que estaba haciendo y no para
 * quien abre el editor por primera vez, que es justo quien pulsa «¿cómo se configura
 * esto?». Se añaden dos cosas que la gente preguntaba fuera del portal: un EJEMPLO
 * concreto —un tipo de nodo se entiende en un caso, no en abstracto— y la comprobación
 * con la que se sabe que el paso quedó bien, porque «ya está» es la parte que nadie
 * escribía y la que decide si el algoritmo valida o no.
 */

export interface NodeTutorial {
  /** Pasos concretos para dejar el nodo funcionando. */
  steps: readonly string[];
  /** Un caso real de este tipo de nodo, para anclar la explicación. */
  example: string;
  /** Cómo saber que quedó bien antes de seguir con el nodo siguiente. */
  check: string;
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
    example:
      'Una solicitud de crédito entra con ingreso mensual, deuda mensual y puntaje de buró: esas tres variables son las que hay declaradas como entrada.',
    check: 'Tiene exactamente una conexión de salida y ningún otro nodo Inicio en el lienzo.',
    pitfall: 'Si una variable no está declarada como entrada, ningún paso podrá leerla.',
  },
  CONDITION: {
    steps: [
      'Elige la variable de entrada que quieres comparar.',
      'Define el operador y el valor: eso crea la condición de este algoritmo.',
      'Conecta DOS salidas: una «Cuando se cumple» y otra «Default / caso contrario».',
    ],
    example:
      '«¿El puntaje de buró es menor que 550?» → si se cumple va al resultado de rechazo; el caso contrario sigue evaluando el resto de la política.',
    check:
      'Del nodo salen dos conexiones y una de ellas está marcada como Default. Con una sola, la validación lo rechaza.',
    pitfall:
      'Sin la rama por defecto, un caso que no cumpla la condición se queda sin camino y la decisión falla.',
  },
  SWITCH: {
    steps: [
      'Elige la variable que decide el reparto.',
      'Añade un caso por cada valor que quieras enrutar; cada uno crea su propia condición.',
      'Deja siempre una salida por defecto para los valores no contemplados.',
    ],
    example:
      'Repartir por tipo de producto: consumo, hipotecario y microcrédito van a tres subárboles distintos, y cualquier otro producto cae en la salida por defecto.',
    check:
      'Ningún par de casos puede cumplirse a la vez con la misma entrada, y hay una salida por defecto.',
    pitfall: 'Dos casos que puedan cumplirse a la vez hacen la decisión no determinista.',
  },
  DECISION_TABLE: {
    steps: [
      'Declara las columnas de entrada y la de resultado.',
      'Añade una fila por regla; se aplica la PRIMERA que se cumple.',
      'Ordena de la más específica a la más general.',
    ],
    example:
      'Tabla de tasa por tramo: (buró ≥ 700, antigüedad ≥ 2 años) → 12 %; (buró ≥ 700) → 15 %; (cualquiera) → 21 %. La primera fila es la más exigente y por eso va arriba.',
    check:
      'La última fila cubre el caso general, y ninguna fila de arriba la deja inalcanzable por ser más amplia.',
    pitfall: 'Una fila general arriba tapa a todas las de abajo, que nunca llegan a evaluarse.',
  },
  EXPRESSION: {
    steps: [
      'Escribe el cálculo en JavaScript o Python (máximo 3 líneas ejecutables).',
      'Lee los datos desde `variables.<código>`, no desde `inputs`.',
      'Guarda el resultado en una variable intermedia o de salida.',
      'Si usas una función de librería, selecciónala: sin eso el guardado se rechaza.',
    ],
    example:
      '`variables.deuda_mensual / variables.ingreso_mensual` guardado en la intermedia `relacion_deuda_ingreso`, que después compara un nodo Condición.',
    check:
      'Cada nombre que aparece tras `variables.` existe en las entradas o en las intermedias declaradas, y el resultado se guarda en algún sitio.',
    pitfall:
      'Usar un nombre de variable que no está declarado como entrada: se detecta al validar, no al escribir.',
  },
  SCORE: {
    steps: [
      'Define el puntaje con código, igual que en Expresión.',
      'Declara el rango esperado en la variable donde lo guardas.',
      'Conecta las bandas de puntaje con nodos Condición.',
    ],
    example:
      'Un puntaje interno de 0 a 100 que suma por antigüedad laboral y resta por relación deuda/ingreso; después tres bandas: ≥ 70 aprueba, 40–69 va a revisión, < 40 rechaza.',
    check:
      'La variable donde se guarda tiene mínimo y máximo declarados, y las bandas cubren todo ese rango sin dejar huecos.',
    pitfall: 'Un puntaje sin límites declarados deja pasar valores fuera de rango sin avisar.',
  },
  REFERENCE: {
    steps: [
      'Elige el algoritmo publicado al que quieres llamar.',
      'Mapea qué variables tuyas alimentan sus entradas.',
      'Mapea qué devuelve a tus variables intermedias o de salida.',
    ],
    example:
      'La política de crédito llama al árbol de fraude ya publicado, le pasa el identificador del solicitante y el dispositivo, y recibe su nivel de riesgo para seguir decidiendo.',
    check:
      'Todas las entradas obligatorias del algoritmo llamado tienen origen, y lo que devuelve está recogido en una variable tuya.',
    pitfall:
      'Referenciar una versión sin compilar se rechaza: el algoritmo llamado debe estar compilado y disponible.',
  },
  MANUAL_REVIEW: {
    steps: [
      'Indica la cola o el equipo que recibirá el caso.',
      'Adjunta los motivos que expliquen por qué se deriva.',
      'Es un paso terminal: cierra el recorrido.',
    ],
    example:
      'Ingreso alto pero documentación incompleta: se deriva a la cola de análisis con el motivo «documentación pendiente de verificar».',
    check: 'Tiene cola asignada, al menos un motivo, y ninguna conexión de salida.',
    pitfall: 'Derivar sin motivos deja al analista sin contexto para decidir.',
  },
  ACTION: {
    steps: [
      'Elige la acción del catálogo del algoritmo (calcular un campo, emitir un motivo…).',
      'Si calcula un campo, las variables que consume deben estar declaradas como entrada.',
      'Conecta una única salida: una acción no bifurca el flujo.',
    ],
    example:
      'Llamar al campo calculado `relacion_deuda_ingreso` con el ingreso y la deuda del solicitante, y dejar el resultado disponible para los pasos siguientes.',
    check: 'Sale exactamente una conexión y las variables que consume están todas declaradas.',
    pitfall:
      'Si la acción usa una variable que el árbol no declara, la validación lo bloquea antes de publicar.',
  },
  RESULT: {
    steps: [
      'Elige el valor de la decisión final.',
      'Adjunta los reason codes que la expliquen.',
      'Comprueba que cada campo del contrato de salida tenga origen declarado.',
    ],
    example:
      'Resultado «RECHAZADO» con los motivos «relación deuda/ingreso por encima del límite» y «puntaje de buró insuficiente», que son los que verá el cliente en su carta.',
    check:
      'Lleva al menos un motivo y ningún campo del contrato de salida se queda sin quien lo escriba.',
    pitfall: 'Un resultado sin motivos no es explicable ante una reclamación.',
  },
  ERROR: {
    steps: [
      'Úsalo para el camino de fallo controlado.',
      'Deja escrito el motivo para que la traza lo muestre.',
    ],
    example:
      'El proveedor de buró no responde: en vez de dejar la ejecución a medias, el camino termina en Error con el motivo «buró no disponible», y operaciones sabe por qué reintentar.',
    check: 'Tiene motivo escrito y se llega a él desde el camino de fallo, no desde el normal.',
    pitfall: 'Un error sin motivo obliga a reconstruir qué pasó desde los logs.',
  },
  END: {
    steps: [
      'Cierra un recorrido que no produce resultado de negocio.',
      'Todo camino del árbol debe terminar en un Fin o en un Resultado.',
    ],
    example:
      'Una rama que sólo registra telemetría y no decide nada sobre el cliente termina en Fin, no en Resultado: no hay decisión que comunicar.',
    check: 'No sale ninguna conexión de él y ningún camino del grafo queda sin cerrar.',
    pitfall: 'Un camino sin final deja la decisión sin cerrar y la validación lo rechaza.',
  },
};

export function tutorialFor(nodeType: string): NodeTutorial | undefined {
  return NODE_TUTORIALS[nodeType];
}
