/**
 * Datos de ejemplo para las capturas de evidencia.
 *
 * Viven aparte de la especificación para que ésta se lea como un guion de
 * capturas y para respetar el límite de 299 líneas del repositorio.
 */

/** Ejecución con traza real para que la reproducción tenga algo que recorrer. */
export const EXECUTION = {
  id: 'exec-demo',
  requestId: 'REQ-DEMO',
  // Sin versión referenciada no hay grafo que dibujar y la reproducción cae en
  // su modo de sólo línea de tiempo; la evidencia debe mostrar el caso completo.
  artifactVersionId: 'ver-demo',
  artifactCode: 'SCORING_CREDITO_CONSUMO',
  environmentCode: 'SANDBOX',
  status: 'COMPLETED',
  outcome: 'APPROVED',
  durationMs: 42,
  traceSteps: [
    { nodeKey: 'INICIO', nodeType: 'START', status: 'COMPLETED', durationMs: 1 },
    {
      nodeKey: 'VALIDA_DATOS',
      nodeType: 'CONDITION',
      status: 'COMPLETED',
      branchTaken: 'e2',
      discardedEdgeKeys: ['e3'],
      durationMs: 7,
    },
    { nodeKey: 'RIESGO', nodeType: 'SCORE', status: 'COMPLETED', durationMs: 22 },
    { nodeKey: 'RESULTADO', nodeType: 'RESULT', status: 'COMPLETED', durationMs: 4 },
  ],
};

export const GRAPH = {
  // El catálogo de acciones y condiciones es lo que permite decir QUÉ hace cada
  // paso; sin él, un nodo de acción sólo podía enseñar su JSON de configuración.
  conditions: [
    { code: 'DATOS_OK', expression: { variable: 'documentos_presentados', operator: 'gte' } },
  ],
  actions: [
    {
      code: 'RECHAZO_DOCUMENTAL',
      type: 'REJECT',
      terminal: true,
      payload: { canal: 'APP', notificar: true },
      reasonCodes: [{ code: 'DOC_MISSING' }, { code: 'DOC_EXPIRED' }],
    },
  ],
  nodes: [
    { key: 'INICIO', type: 'START', label: 'Inicio', x: 6, y: 30 },
    {
      key: 'VALIDA_DATOS',
      type: 'CONDITION',
      label: 'Validación de datos',
      x: 26,
      y: 30,
      config: { conditionCode: 'DATOS_OK' },
    },
    {
      key: 'RIESGO',
      type: 'SCORE',
      label: 'Evaluación de riesgo',
      x: 48,
      y: 18,
      config: {
        targetVariable: 'puntaje_riesgo',
        script: { language: 'PYTHON', source: 'x = variables.get("ingreso_mensual")' },
      },
    },
    {
      key: 'RECHAZO',
      // Colocado cerca del origen del lienzo a propósito: el "mundo" del editor
      // es mayor que la ventana, y un nodo al 48 % quedaría fuera de la captura.
      type: 'ACTION',
      label: 'Rechazo documental',
      x: 4,
      y: 56,
      actions: [{ actionCode: 'RECHAZO_DOCUMENTAL', order: 1 }],
    },
    { key: 'RESULTADO', type: 'RESULT', label: 'Resultado final', x: 70, y: 30, terminal: true },
  ],
  edges: [
    { key: 'e1', from: 'INICIO', to: 'VALIDA_DATOS' },
    { key: 'e2', from: 'VALIDA_DATOS', to: 'RIESGO' },
    { key: 'e3', from: 'VALIDA_DATOS', to: 'RECHAZO', default: true },
    { key: 'e4', from: 'RIESGO', to: 'RESULTADO' },
  ],
};

/** Catálogo con volumen y sentidos mezclados, para lucir orden y búsqueda. */
export const VARIABLES = [
  {
    id: '1',
    variableCode: 'ingreso_mensual',
    name: 'Ingreso mensual',
    usage: 'INPUT',
    category: 'FINANCIERA',
    dataType: 'NUMBER',
    source: 'CORE_BANCARIO',
    latestVersion: '2.1.0',
    sensitivity: 'PII',
    status: 'ACTIVE',
    updatedAt: '2026-07-20T10:00:00Z',
  },
  {
    id: '2',
    variableCode: 'score_buro',
    name: 'Score de buró',
    usage: 'INPUT',
    category: 'RIESGO',
    dataType: 'INTEGER',
    source: 'BURO_EXTERNO',
    latestVersion: '1.4.0',
    sensitivity: 'PII',
    status: 'ACTIVE',
    updatedAt: '2026-02-11T09:30:00Z',
  },
  {
    id: '3',
    variableCode: 'decision',
    name: 'Decisión final',
    usage: 'OUTPUT',
    category: 'RESULTADO',
    dataType: 'STRING',
    source: 'MOTOR',
    latestVersion: '3.0.0',
    sensitivity: 'PUBLIC',
    status: 'ACTIVE',
    updatedAt: '2026-12-01T18:05:00Z',
  },
  {
    id: '4',
    variableCode: 'edad',
    name: 'Edad del solicitante',
    usage: 'INPUT',
    category: 'DEMOGRAFICA',
    dataType: 'INTEGER',
    source: 'ONBOARDING',
    latestVersion: '1.0.0',
    sensitivity: 'PII',
    status: 'DRAFT',
    updatedAt: '2026-05-02T08:00:00Z',
  },
];

/**
 * Respuesta del motor cuando el resultado de Python se reparte en varias
 * líneas. Copiada de una llamada real a `/v1/code-imports` en el entorno de
 * desarrollo, para que la captura muestre el aviso tal y como llega.
 */
export const CODE_IMPORT_WARNING = {
  id: 'import-demo',
  issues: [
    {
      source: 'GRAPH',
      severity: 'WARNING',
      line: 4,
      code: 'CODE_IMPORT_TREE_NOT_DERIVABLE',
      message:
        'No se pudo derivar el árbol de decisión: la clave de un resultado debe ser un texto. Se importará como un único nodo de script.',
    },
  ],
  generatedGraph: {
    dependencies: [
      { variableCode: 'edad', usageType: 'INPUT', dataType: 'INTEGER' },
      { variableCode: 'decision', usageType: 'OUTPUT_PRIMARY', dataType: 'STRING' },
    ],
    nodes: [
      { key: 'INICIO', type: 'START', label: 'Inicio' },
      { key: 'CODE_IMPORT_RESULT', type: 'RESULT', label: 'Código importado' },
    ],
    edges: [{ key: 'e1', from: 'INICIO', to: 'CODE_IMPORT_RESULT' }],
  },
};
