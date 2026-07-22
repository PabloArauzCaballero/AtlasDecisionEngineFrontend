/**
 * Explicación de negocio + sistemas por pantalla, al estilo del portal interno.
 * Se resuelve por el primer segmento de la ruta, así que las vistas de detalle
 * (p. ej. /artifacts/123) heredan la explicación de su sección.
 */
export interface ViewExplanation {
  /** Nombre funcional de la sección (se muestra en la cabecera). */
  module: string;
  /** Para qué sirve a nivel de negocio. */
  business: string;
  /** Qué hace a nivel técnico/sistemas. */
  systems: string;
}

export const explanations: Readonly<Record<string, ViewExplanation>> = {
  variables: {
    module: 'Catálogo de Variables · F1-01',
    business:
      'El vocabulario común de las decisiones: cada variable (KYC, edad, riesgo…) con su dueño, clasificación y sensibilidad. Garantiza que reglas y modelos hablen el mismo idioma y que sea auditable qué dato entra a cada decisión.',
    systems:
      'Lista `decision_variable_definition` con su versión vigente, tipo de dato, fuente autoritativa y estado. El versionado es inmutable; el detalle expone fuentes, reglas de validación y en qué artefactos se usa cada variable.',
  },
  'reason-codes': {
    module: 'Catálogo de Reason Codes · F1-06',
    business:
      'Los códigos explicables detrás de cada resultado (crédito, fraude, cumplimiento). Aseguran que un rechazo o una alerta tengan un motivo consistente y comunicable al cliente y al regulador.',
    systems:
      '`decision_reason_code` con categoría, severidad, mensaje público/interno y bandera de acción adversa. Se referencian desde las acciones de las reglas para explicar cada outcome.',
  },
  artifacts: {
    module: 'Inventario de Artefactos · F2-01',
    business:
      'El repositorio de las políticas de decisión (BNPL, fraude…): qué existe, quién lo posee, en qué versión y ambiente está. Es el punto de control de qué lógica gobierna las decisiones que ven los clientes.',
    systems:
      '`decision_artifact` con sus versiones (`decision_artifact_version`): estado del ciclo (DRAFT→DEPLOYED), checksum canónico y ambiente inferido. El detalle abre el grafo, las dependencias de variables y el historial de despliegues.',
  },
  'graph-editor': {
    module: 'Editor de Grafo · Diseño',
    business:
      'El lienzo donde se diseña visualmente el flujo de una decisión: nodos, condiciones y acciones que determinan el resultado. Deja que riesgo y negocio vean y ajusten la lógica sin leer código.',
    systems:
      'Renderiza nodos y aristas (`decision_rule_node` / `decision_rule_edge`) de una versión de artefacto con sus condiciones y acciones. Persiste posiciones y orden de evaluación, y compila a un artefacto ejecutable.',
  },
  'code-import': {
    module: 'Importar Código · Diseño',
    business:
      'Traduce lógica existente (código o reglas legadas) a un artefacto versionado del motor, para migrar decisiones sin reescribirlas a mano ni perder trazabilidad.',
    systems:
      'Parsea la fuente y propone nodos, condiciones y acciones; genera un borrador de versión que luego se revisa en el editor y se compila.',
  },
  'test-suites': {
    module: 'Suites de Prueba · Calidad',
    business:
      'Conjuntos de casos que validan que una política decide lo esperado antes de exponerla a clientes. Son la red de seguridad de cada release.',
    systems:
      'Suites versionadas que agrupan casos; se ejecutan contra una versión de artefacto y reportan pass/fail por caso con su evidencia.',
  },
  'test-cases': {
    module: 'Casos de Prueba · Calidad',
    business:
      'Cada escenario concreto (entrada → resultado esperado) que una decisión debe cumplir. Documentan el comportamiento acordado con el negocio.',
    systems:
      'Casos con payload de entrada y aserciones sobre el outcome; alimentan las suites y la matriz de cobertura.',
  },
  'coverage-matrix': {
    module: 'Cobertura · Calidad',
    business:
      'Muestra qué partes de la lógica de decisión están probadas y cuáles no, para saber dónde hay riesgo sin cubrir antes de desplegar.',
    systems:
      'Cruza los casos de prueba contra los nodos y ramas del grafo; resalta condiciones y caminos que ningún caso ejercita.',
  },
  'graph-coverage': {
    module: 'Cobertura de Grafo · Calidad',
    business:
      'La cobertura vista sobre el propio diagrama de la decisión: de un vistazo se ve qué caminos del flujo faltan por probar.',
    systems:
      'Proyecta el resultado de las pruebas sobre los nodos/aristas de la versión, coloreando lo cubierto vs. lo no ejercitado.',
  },
  reviews: {
    module: 'Bandeja de Revisiones · F4-01 · Gobierno',
    business:
      'El control de aprobaciones: ninguna política llega a producción sin la venia de Quality, Riesgo y Compliance. Deja evidencia de quién aprobó qué y cuándo.',
    systems:
      'Solicitudes de aprobación con workflow multi-paso, SLA por paso y decisiones firmadas por rol (`approval-requests`).',
  },
  environments: {
    module: 'Ambientes · Gobierno',
    business:
      'Define los entornos (sandbox, staging, producción) por los que pasa una decisión antes de afectar a clientes reales, y las reglas para promover entre ellos.',
    systems:
      'Catálogo de ambientes y su configuración; gobierna a qué entorno se despliega cada versión de artefacto.',
  },
  'platform-health': {
    module: 'Platform Health · Plataforma',
    business:
      'Un vistazo al estado vivo de la plataforma de decisiones: si algo crítico está caído, se ve aquí antes de que un cliente lo sufra.',
    systems:
      'Probes a las dependencias (base de datos, Redis, motor de ejecución) y métricas de salud del servicio en tiempo real.',
  },
  executions: {
    module: 'Buscador de Ejecuciones · F6-01 · Auditoría',
    business:
      'Reconstruye cualquier decisión pasada: qué entró, qué salió, con qué versión y por qué. Es la base de disputas, auditorías y soporte.',
    systems:
      'Consulta reproducible (`audit/executions`) por request id, artefacto/versión, outcome, duración y traza completa de evaluación.',
  },
  'audit-events': {
    module: 'Bitácora de Auditoría · F6-05',
    business:
      'La cadena inmutable de todo lo que pasó en la plataforma (quién cambió qué, cuándo). Evidencia no repudiable para cumplimiento.',
    systems:
      'Eventos encadenados por hash (anterior/actual): cualquier alteración rompe la cadena y se detecta.',
  },
  deployments: {
    module: 'Historial de Despliegues · F4-07',
    business:
      'El registro auditable de qué versión se promovió a cada ambiente, cuándo y con qué resultado, incluidos los rollbacks.',
    systems:
      '`deployments` con checksum, ambiente, autor y estado, ligados a la versión de artefacto desplegada.',
  },
  objectives: {
    module: 'Objetivos de Negocio · F7-01',
    business:
      'Conecta las metas del negocio con las políticas, artefactos y pruebas que las cumplen — trazabilidad de extremo a extremo.',
    systems:
      '`traceability/objectives` con métricas y conteos de políticas, artefactos y pruebas vinculados a cada objetivo.',
  },
  'manual-reviews': {
    module: 'Cola de Revisión Manual · F5-03 · Operación',
    business:
      'Casos que la automatización deriva a una persona (por riesgo o política). Asegura una decisión humana controlada, con SLA y prioridad.',
    systems:
      '`manual-reviews` con prioridad, asignación, SLA y referencia enmascarada del sujeto de la decisión.',
  },
  simulator: {
    module: 'Simulador · Diseño',
    business:
      'Prueba una política con datos de ejemplo y ve el resultado al instante, sin afectar nada real — para diseñar, validar y explicar decisiones.',
    systems:
      'Ejecuta una versión de artefacto contra un payload de entrada y muestra outcome, reason codes y la traza de evaluación.',
  },
  'live-execution': {
    module: 'Ejecución en Vivo · F8',
    business:
      'Observa decisiones ejecutándose en tiempo real, útil para monitoreo operativo y demostraciones.',
    systems: 'Stream de eventos (SSE) de la ejecución sobre la conexión autenticada, sin polling.',
  },
  search: {
    module: 'Búsqueda Global',
    business:
      'Encuentra cualquier artefacto, variable o solicitud al instante, desde un único lugar.',
    systems:
      'Busca a través de los catálogos por código o nombre y enlaza a la ficha correspondiente.',
  },
};

export function resolveExplanation(pathname: string): ViewExplanation | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment ? (explanations[segment] ?? null) : null;
}
