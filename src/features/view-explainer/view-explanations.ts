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
  /** Cómo funciona por dentro, en palabras de quien usa la pantalla (sin nombres de tablas ni de código). */
  systems: string;
}

export const explanations: Readonly<Record<string, ViewExplanation>> = {
  variables: {
    module: 'Catálogo de variables',
    business:
      'El vocabulario común de las decisiones: cada variable (KYC, edad, riesgo…) con su dueño, clasificación y sensibilidad. Garantiza que reglas y modelos hablen el mismo idioma y que sea auditable qué dato entra a cada decisión.',
    systems:
      'Lista cada variable con su versión vigente, tipo de dato, de dónde sale y su estado. Una versión publicada no se modifica: se crea otra. Al abrir una variable ves de dónde se obtiene, qué valores acepta y qué algoritmos la usan.',
  },
  'reason-codes': {
    module: 'Catálogo de motivos',
    business:
      'Los códigos explicables detrás de cada resultado (crédito, fraude, cumplimiento). Aseguran que un rechazo o una alerta tengan un motivo consistente y comunicable al cliente y al regulador.',
    systems:
      'Cada motivo tiene categoría, severidad, un mensaje para el cliente y otro para el analista, y marca si es una decisión adversa. Las reglas los usan para explicar cada resultado.',
  },
  artifacts: {
    module: 'Inventario de algoritmos',
    business:
      'El repositorio de las políticas de decisión (BNPL, fraude…): qué existe, quién lo posee, en qué versión y ambiente está. Es el punto de control de qué lógica gobierna las decisiones que ven los clientes.',
    systems:
      'Cada algoritmo con sus versiones, el estado de cada una (de borrador a publicada) y el ambiente donde está. Al abrirlo ves su diagrama, las variables que usa y su historial de publicaciones.',
  },
  algorithms: {
    module: 'Algoritmos y versiones',
    business:
      'La vista general de todos los algoritmos de decisión y su historial de versiones. Deja ver de un vistazo qué existe, en qué estado está cada versión (borrador, en revisión, publicada) y saltar a construir, validar o probar cada una.',
    systems:
      'Busca algoritmos y fíltralos por estado. Cada fila se despliega para ver sus versiones y saltar al diagrama, a la compilación o a sus pruebas.',
  },
  'graph-editor': {
    module: 'Editor del diagrama',
    business:
      'El lienzo donde se diseña visualmente el flujo de una decisión: nodos, condiciones y acciones que determinan el resultado. Deja que riesgo y negocio vean y ajusten la lógica sin leer código.',
    systems:
      'Dibuja los pasos y las conexiones de una versión, con sus condiciones y acciones. Guarda la posición y el orden en que se evalúa cada paso, y la convierte en una versión que el motor puede ejecutar.',
  },
  'code-import': {
    module: 'Importar código',
    business:
      'Traduce lógica existente (código o reglas legadas) a un algoritmo versionado del motor, para migrar decisiones sin reescribirlas a mano ni perder trazabilidad.',
    systems:
      'Lee el código y propone los pasos, condiciones y acciones; crea un borrador que luego revisas en el editor. Sólo puede usar variables y motivos que ya existan en los catálogos, igual que cualquier otro algoritmo.',
  },
  'test-suites': {
    module: 'Suites de prueba',
    business:
      'Conjuntos de casos que validan que una política decide lo esperado antes de exponerla a clientes. Son la red de seguridad antes de cada publicación.',
    systems:
      'Agrupan casos de prueba y se corren contra una versión del algoritmo; dicen qué casos salieron bien y cuáles no, con su evidencia.',
  },
  'test-cases': {
    module: 'Casos de prueba',
    business:
      'Cada escenario concreto (entrada → resultado esperado) que una decisión debe cumplir. Documentan el comportamiento acordado con el negocio.',
    systems:
      'Cada caso lleva unos datos de entrada y el resultado que se espera; forman las suites y la matriz de cobertura.',
  },
  'coverage-matrix': {
    module: 'Cobertura de las pruebas',
    business:
      'Muestra qué partes de la lógica de decisión están probadas y cuáles no, para saber dónde hay riesgo sin cubrir antes de desplegar.',
    systems:
      'Cruza los casos de prueba con los pasos del diagrama y resalta las condiciones y caminos que ningún caso recorre.',
  },
  'graph-coverage': {
    module: 'Cobertura sobre el diagrama',
    business:
      'La cobertura vista sobre el propio diagrama de la decisión: de un vistazo se ve qué caminos del flujo faltan por probar.',
    systems: 'Pinta sobre el diagrama lo que las pruebas recorrieron y lo que quedó sin probar.',
  },
  reviews: {
    module: 'Bandeja de revisiones',
    business:
      'El control de aprobaciones: ninguna política llega a producción sin la aprobación de Calidad, Riesgo y Cumplimiento. Deja evidencia de quién aprobó qué y cuándo.',
    systems:
      'Cada solicitud pasa por varios pasos de aprobación, cada uno con su plazo, y cada paso lo firma una persona con el rol que corresponde.',
  },
  environments: {
    module: 'Ambientes',
    business:
      'Define los entornos (pruebas, preproducción, producción) por los que pasa una decisión antes de afectar a clientes reales, y las reglas para promover entre ellos.',
    systems:
      'Lista los ambientes y su configuración, y controla a cuál se publica cada versión de un algoritmo.',
  },
  'platform-health': {
    module: 'Estado de la plataforma',
    business:
      'Un vistazo al estado vivo de la plataforma de decisiones: si algo crítico está caído, se ve aquí antes de que un cliente lo sufra.',
    systems:
      'Comprueba cada pocos segundos que la base de datos, la memoria de trabajo y el motor responden, y muestra el resultado al momento.',
  },
  executions: {
    module: 'Buscador de ejecuciones',
    business:
      'Reconstruye cualquier decisión pasada: qué entró, qué salió, con qué versión y por qué. Es la base de disputas, auditorías y soporte.',
    systems:
      'Busca por identificador de la solicitud, algoritmo, versión, resultado o duración, y abre el recorrido completo de cada decisión.',
  },
  'audit-events': {
    module: 'Bitácora de auditoría',
    business:
      'La cadena inmutable de todo lo que pasó en la plataforma (quién cambió qué, cuándo). Evidencia no repudiable para cumplimiento.',
    systems:
      'Cada evento lleva un sello que depende del anterior: si alguien alterara uno, la cadena se rompe y se nota.',
  },
  /*
   * Las tres pantallas de medición van seguidas y en su orden, porque el orden es
   * justamente lo que se confunde: si hay datos con los que medir, si el modelo se
   * degrada y bajo qué condiciones se le deja operar. Sin explicador, las cuatro
   * pantallas nuevas de «Auditoría» se abrían sin decir qué preguntan, que es peor
   * aquí que en un catálogo: las usa gente que no diseñó el sistema.
   */
  'decision-quality': {
    module: 'Calidad de la decisión',
    business:
      'Mide el sistema de medición: cuántas decisiones saben a quién decidieron y cuántas ventanas de observación vencidas cerró alguien. Es la pregunta ANTERIOR a la degradación del modelo — un tablero en verde sobre un sistema de observación apagado es la lectura peligrosa que esta pantalla existe para impedir.',
    systems:
      'Cobertura de sujeto y de desenlace por ventana, cola de ventanas vencidas, carga en lote validada antes de escribir, punto de corte y matriz de cosechas. Una medida que no se pudo tomar sale como «—» en tono neutro, nunca como 0 en rojo.',
  },
  'model-monitoring': {
    module: 'Monitoreo del modelo',
    business:
      'Vigila si una versión desplegada se está degradando: si sigue acertando, si le siguen llegando los mismos solicitantes y si trata igual a grupos comparables. Un acierto estable sobre una población que cambió no es un buen modelo: es uno al que todavía no le ha tocado.',
    systems:
      'Tres análisis de lectura sobre una versión y una ventana: desempeño observado, estabilidad de la población (comparada con una referencia que se declara a mano, para que la cifra sea reproducible) e impacto adverso por atributo en bandas, apartando los grupos con muestra pequeña.',
  },
  'risk-governance': {
    module: 'Gobierno del riesgo',
    business:
      'Lo que condiciona una decisión sin tomarla: apetito de cartera, calibración, licitud vigente, reidentificación y expediente del modelo. Están juntas porque comparten una propiedad incómoda — son las que se saltan cuando hay prisa.',
    systems:
      'Límites de exposición con su modo (bloquea o sólo mide, y se ven distinto), curva de calibración construida sólo con desenlaces observados, permisos con vigencia, reidentificación con doble firma y expediente de validación con fecha de próxima revisión.',
  },
  'data-subject-requests': {
    module: 'Derechos del titular',
    business:
      'Registra y resuelve lo que una persona pide sobre sus propios datos: acceso a las decisiones que se tomaron sobre ella, portabilidad, eliminación y revisión humana de una decisión automática. Son derechos con plazo legal (LGPD art. 18 y 20; CCPA/CPRA), no consultas de cortesía.',
    systems:
      'El identificador de la persona nunca aparece en la dirección de la página, para que no quede escrito en ningún registro. Al registrar la solicitud se responde en el momento con su historial, y sólo se entregan los motivos que se pueden mostrar al cliente.',
  },
  deployments: {
    module: 'Historial de despliegues',
    business:
      'El registro auditable de qué versión se promovió a cada ambiente, cuándo y con qué resultado, incluidas las vueltas a una versión anterior.',
    systems:
      'Cada despliegue con su ambiente, quién lo hizo, su estado y la huella de la versión desplegada.',
  },
  objectives: {
    module: 'Objetivos de negocio',
    business:
      'Conecta las metas del negocio con las políticas, algoritmos y pruebas que las cumplen — trazabilidad de extremo a extremo.',
    systems:
      'Cada objetivo con sus métricas y cuántas políticas, algoritmos y pruebas lo sostienen.',
  },
  'manual-reviews': {
    module: 'Cola de revisión manual',
    business:
      'Casos que la automatización deriva a una persona (por riesgo o política). Asegura una decisión humana controlada, con plazo y prioridad.',
    systems:
      'Cada caso con su prioridad, cola, estado, responsable, plazo y la decisión automática que lo originó.',
  },
  simulator: {
    module: 'Simulador',
    business:
      'Prueba una política con datos de ejemplo y ve el resultado al instante, sin afectar nada real — para diseñar, validar y explicar decisiones.',
    systems:
      'Corre una versión del algoritmo con los datos que escribas y muestra el resultado, los motivos y el recorrido paso a paso.',
  },
  'sql-console': {
    module: 'Consultas SQL',
    business:
      'Responde con SQL las preguntas que ninguna pantalla contesta todavía: cruzar decisiones con desenlaces, buscar el segmento donde el modelo falla, medir cuánto tardó la aprobación de un mes concreto. Sirve para no depender de que alguien programe una vista cada vez que cambia la pregunta.',
    systems:
      'Sólo lectura: desde aquí no se puede modificar nada, sólo ves los datos de tu empresa, y cada consulta se revisa antes de correrla. Todas las consultas, también las rechazadas, quedan registradas con tu nombre.',
  },
  search: {
    module: 'Búsqueda',
    business:
      'Encuentra cualquier algoritmo, variable o solicitud al instante, desde un único lugar.',
    systems:
      'Busca a través de los catálogos por código o nombre y enlaza a la ficha correspondiente.',
  },
};

export function resolveExplanation(pathname: string): ViewExplanation | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment ? (explanations[segment] ?? null) : null;
}
