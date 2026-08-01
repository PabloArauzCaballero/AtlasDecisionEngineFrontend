import type { InteractiveTutorial } from './interactive-types';

/**
 * Tutoriales guiados de los CATÁLOGOS y la CALIDAD (listados que usan
 * ResourceListPage). Cada paso apunta a un elemento real de la pantalla
 * (`data-tutorial-id`) y varios esperan a que la persona haga la acción: el
 * recorrido se hace haciendo, no leyendo. Texto para quien no programa.
 */
const t = (
  id: string,
  title: string,
  intro: string,
  steps: InteractiveTutorial['steps'],
): InteractiveTutorial => ({ id, title, intro, version: 2, steps });

/** Pasos comunes a todo listado: buscar, filtrar, leer la tabla y dar de alta. */
const listSteps = (what: string, createHint: string): InteractiveTutorial['steps'] => [
  {
    id: 'filters',
    target: '[data-tutorial-id="resource-filters"]',
    title: 'Buscar sin perderte',
    content: `Escribe aquí parte del código o del nombre para encontrar ${what} entre cientos de registros. La búsqueda se aplica al pulsar "Buscar".`,
    tip: 'El icono de controles abre filtros adicionales; el número indica cuántos tienes activos.',
    optional: true,
  },
  {
    id: 'table',
    target: '[data-tutorial-id="resource-table"]',
    title: 'Leer la tabla',
    content:
      'Cada fila es un registro y el encabezado dice cuántos hay en total. Las columnas con ⓘ explican qué significa ese dato; haz clic en una fila para abrir su ficha completa.',
  },
  {
    id: 'create',
    target: '[data-tutorial-id="resource-create"]',
    title: 'Dar de alta',
    content: createHint,
    tip: 'Cada campo del formulario tiene un ⓘ con un ejemplo: no hace falta conocer el modelo de datos.',
    requiredAction: 'click',
    optional: true,
  },
];

export const TOOL_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  variables: t(
    'variables',
    'Catálogo de Variables',
    'Los datos con los que deciden tus algoritmos, y en qué sentido los usan.',
    [
      {
        id: 'what',
        title: '¿Qué veo aquí?',
        content:
          'El catálogo de todos los DATOS que una decisión puede usar: edad, ingreso, score de buró… Cada variable tiene un código estable, un tipo y una versión. Es el vocabulario del sistema.',
      },
      {
        id: 'usage',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Entrada o salida: la diferencia clave',
        content:
          'La columna “Uso” dice en qué sentido la usan los algoritmos. ENTRADA es un dato que hay que APORTAR al evaluar (lo pide el simulador). SALIDA es un resultado que el motor PRODUCE. Una misma variable puede ser ambas cosas en artefactos distintos.',
        tip: 'Con el filtro “Entrada / Salida” te quedas sólo con uno de los dos grupos.',
      },
      ...listSteps(
        'una variable',
        'Con “Add Variable” defines un dato nuevo: código en MAYÚSCULAS (no cambia nunca), nombre legible, tipo y si es sensible. Pruébalo.',
      ),
    ],
  ),
  'reason-codes': t(
    'reason-codes',
    'Catálogo de Reason Codes',
    'Los motivos explicables que acompañan cada decisión.',
    [
      {
        id: 'what',
        title: '¿Para qué existe?',
        content:
          'Un reason code es el MOTIVO que acompaña una decisión (por qué se aprobó o rechazó). Es la base de la transparencia y de los avisos legales al cliente.',
      },
      {
        id: 'msgs',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Mensaje público vs interno',
        content:
          'El mensaje público lo ve el cliente (claro, sin tecnicismos); el interno lo ve el analista y puede ser técnico. La categoría agrupa por dominio (KYC, fraude, riesgo…).',
      },
      {
        id: 'adverse',
        title: 'Decisión adversa',
        content:
          'Si un motivo está marcado como “adverse action”, la ley obliga a notificarlo al cliente cuando se rechaza. El motor lo adjunta automáticamente a la decisión.',
      },
      ...listSteps('un motivo', 'Con “Add Reason Code” creas un motivo nuevo. Pruébalo.'),
    ],
  ),
  artifacts: t(
    'artifacts',
    'Inventario de Artefactos',
    'Todos los algoritmos de decisión del sistema.',
    [
      {
        id: 'what',
        title: '¿Qué es un artefacto?',
        content:
          'Un artefacto es un algoritmo de decisión versionable: su grafo, sus reglas y su contrato de entradas y salidas. Aquí ves y creas todos los del sistema.',
      },
      {
        id: 'open',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Abre uno para gobernarlo',
        content:
          'Haz clic en una fila: entras a su ficha, con el resumen, el árbol de versiones y los accesos al editor de grafo, las pruebas y las aprobaciones.',
      },
      ...listSteps(
        'un artefacto',
        'Con “Add Artifact” creas el algoritmo (aún vacío); después se le diseña el grafo en el editor.',
      ),
    ],
  ),
  algorithms: t(
    'algorithms',
    'Algoritmos y Versiones',
    'El historial de cada algoritmo, versión a versión.',
    [
      {
        id: 'what',
        title: '¿Qué veo?',
        content:
          'Cada fila es un algoritmo. Al desplegarla ves sus versiones, el estado de cada una (borrador, en revisión, aprobada, desplegada) y quién la creó.',
      },
      {
        id: 'states',
        target: '[data-tutorial-id="resource-table"]',
        title: 'El ciclo de vida',
        content:
          'Una versión nace en BORRADOR, se valida y compila, pasa a revisión, se aprueba y sólo entonces se despliega. Nada llega a producción saltándose ese camino.',
      },
      {
        id: 'act',
        title: 'Actuar sobre una versión',
        content:
          'Desde cada versión saltas a su grafo, a validarla/compilarla o a sus pruebas. Filtra por estado para encontrar lo que está pendiente.',
      },
    ],
  ),
  'test-suites': t(
    'test-suites',
    'Suites de Prueba',
    'Comprobar que una versión decide como esperas.',
    [
      {
        id: 'what',
        title: '¿Qué es una suite?',
        content:
          'Un conjunto de casos que se ejecutan juntos sobre una versión compilada. Si la suite es BLOQUEANTE y falla, la versión no puede desplegarse.',
      },
      {
        id: 'run',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Ejecutar y leer el resultado',
        content:
          'Al correrla, cada caso pasa (verde) o falla (rojo) comparando el resultado real con el esperado. La corrida guarda además la cobertura: qué nodos y caminos del grafo se llegaron a probar.',
        tip: 'Un caso que falla te dice la ruta exacta (p. ej. $.reasonCodes), lo esperado y lo obtenido.',
      },
      ...listSteps(
        'una suite',
        'Con “Add Test Suite” creas una suite para una versión concreta; luego le añades casos.',
      ),
    ],
  ),
  'test-cases': t('test-cases', 'Casos de Prueba', 'Los ejemplos concretos de una suite.', [
    {
      id: 'what',
      title: '¿Qué es un caso?',
      content:
        'Un ejemplo concreto: unas entradas (ingreso 4000, sin deuda, KYC verificado) y el resultado que debería dar (aprobado, con cierto motivo).',
    },
    {
      id: 'assert',
      target: '[data-tutorial-id="resource-table"]',
      title: 'Qué se compara',
      content:
        'El resultado esperado se compara campo a campo: el desenlace (outcome), los motivos (reasonCodes) y cualquier salida declarada. Sólo se comprueban los campos que declares.',
    },
    {
      id: 'generar',
      title: 'La entrada no hay que teclearla',
      content:
        'Al añadir un caso, «Generar entrada» pide al motor unos valores derivados del contrato de la versión que prueba esta suite: válidos, en el límite o inválidos a propósito. También puedes importar un CSV con muchos casos de golpe.',
      tip: 'El resultado esperado NO se genera: es justo lo que la prueba afirma, y deducirlo ejecutando el algoritmo haría que el caso pasara siempre.',
    },
    ...listSteps('un caso', 'Con “Add Test Case” añades un ejemplo nuevo a una suite.'),
  ]),
  coverage: t('coverage', 'Cobertura', 'Qué partes del algoritmo llegaron a probarse.', [
    {
      id: 'what',
      title: '¿Qué mide?',
      content:
        'Qué porcentaje de nodos, conexiones y finales del grafo recorrieron tus pruebas. Lo que nunca se recorre es lo que nadie ha comprobado.',
    },
    {
      id: 'gaps',
      title: 'Los pendientes son el trabajo',
      content:
        'La lista de “pendientes” nombra los nodos o caminos sin cubrir: cada uno necesita un caso de prueba nuevo que lo alcance.',
    },
  ]),
};
