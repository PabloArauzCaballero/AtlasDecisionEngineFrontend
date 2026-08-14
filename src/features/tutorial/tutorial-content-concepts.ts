import type { Tutorial } from './tutorial.types';

/**
 * Business-level concept docs for data/financial analysts who do not code.
 * Minimalist but explanatory: what each core entity IS and why it matters.
 * Surfaced from the tutorial drawer, independent of the current route.
 */
export const conceptTutorials: Readonly<Record<string, Tutorial>> = {
  artifact: {
    eyebrow: 'Concepto · Fundamentos',
    title: '¿Qué es un artefacto?',
    intro:
      'La unidad central de decisión: el "programa" de negocio que decide, versionado y auditable.',
    steps: [
      {
        title: 'La idea en una frase',
        body: 'Un artefacto encapsula UNA decisión de negocio completa — por ejemplo, "¿aprobamos este crédito?". Reúne las reglas, el árbol de decisión y el contrato de datos que esa decisión necesita. Es como una política escrita, pero ejecutable y trazable.',
      },
      {
        title: 'Versiones inmutables',
        body: 'Cada cambio produce una VERSIÓN nueva. Una versión publicada nunca se altera: así siempre puedes reproducir qué decidió el motor en una fecha dada. Para ti, eso es evidencia auditable.',
      },
      {
        title: 'Del borrador a producción',
        body: 'Una versión recorre: borrador → validación → aprobación → despliegue a un ambiente. No decide en producción hasta que pasa sus pruebas y aprobaciones.',
      },
      {
        title: 'Por qué te importa',
        body: 'Cada decisión que analices apunta a un artefacto + versión concretos. Eso te deja comparar el desempeño entre versiones y explicar por qué cambió un resultado.',
      },
    ],
  },
  variable: {
    eyebrow: 'Concepto · Fundamentos',
    title: '¿Qué es una variable?',
    intro: 'Los datos que entran y salen de una decisión — el vocabulario compartido del motor.',
    steps: [
      {
        title: 'Entradas y salidas',
        body: 'Una variable de ENTRADA es un dato que la decisión recibe (ingreso mensual, edad, score de buró). Una de SALIDA es un resultado que produce (nivel de riesgo, límite aprobado).',
      },
      {
        title: 'Un contrato versionado',
        body: 'Cada variable tiene un código estable, un tipo (número, texto, booleano, fecha) y una clasificación. El motor solo usa variables declaradas en el catálogo: eso evita errores de dato.',
      },
      {
        title: 'Sensibilidad y privacidad',
        body: 'Algunas variables contienen datos personales (PII) y se marcan como sensibles para aplicarles controles. Al segmentar o analizar, respeta esa clasificación.',
      },
    ],
  },
  'output-variable': {
    eyebrow: 'Concepto · Fundamentos',
    title: '¿Qué es una variable de salida?',
    intro: 'El resultado que la decisión devuelve — su conclusión útil para el resto del negocio.',
    steps: [
      {
        title: 'La idea en una frase',
        body: 'Una variable de salida representa el resultado que el árbol de decisión devuelve después de evaluar la información de entrada. Por ejemplo, si el sistema analiza el riesgo de una operación, una salida podría ser «Riesgo alto», «Riesgo medio» o «Riesgo bajo».',
      },
      {
        title: 'Por qué es imprescindible',
        body: 'Sin una salida, el sistema puede ejecutar reglas, pero no puede comunicar una conclusión útil a las demás aplicaciones ni a los responsables de tomar decisiones. La salida es lo que otros sistemas leen para actuar (aprobar, derivar, rechazar).',
      },
      {
        title: 'La salida principal',
        body: 'Cuando hay varias salidas, marcas una como PRINCIPAL (la estrella): es el resultado que resume la decisión. Debe ser un valor simple (número, texto o booleano), no un objeto.',
      },
      {
        title: 'Qué revisar antes de guardar',
        body: 'Cada salida declarada debe producirse en algún nodo de Resultado; si no, la «Revisión de flujo» te avisará de que esa salida no se está asignando. Una salida mal tipada o sin asignar hace que la decisión no devuelva lo que esperan las aplicaciones consumidoras.',
      },
    ],
  },
  'nested-tree': {
    eyebrow: 'Concepto · Composición',
    title: '¿Qué es un árbol interno (referenciar otro algoritmo)?',
    intro: 'Reutilizar un algoritmo dentro de otro para componer decisiones complejas por partes.',
    steps: [
      {
        title: 'La idea en una frase',
        body: 'Un árbol interno es un algoritmo que otro algoritmo invoca como un paso de su flujo. En un nodo de Resultado eliges el modo «Referenciar otro algoritmo» y ese nodo ejecuta un artefacto hijo.',
      },
      {
        title: 'Entradas y salidas que encajan',
        body: 'Alimentas las entradas del hijo desde las variables del flujo padre, y traes las salidas del hijo a tus propias variables de resultado. Así el resultado del hijo «coincide con la entrada» de tu decisión.',
      },
      {
        title: 'Ejemplo',
        body: 'Un árbol «Evaluación de solicitud» puede referenciar «Evaluación de riesgo financiero» y «Validación documental» como árboles internos, y combinar sus salidas en un resultado final.',
      },
      {
        title: 'Seguridad del encadenamiento',
        body: 'Defines qué pasa si el hijo falla (fallar en cerrado, usar una salida de reserva u omitir). El motor impide referencias circulares y limita la profundidad para que nunca haya recursión infinita.',
      },
    ],
  },
  'reason-code': {
    eyebrow: 'Concepto · Fundamentos',
    title: '¿Qué es un reason code?',
    intro: 'El "porqué" explicable que acompaña cada decisión.',
    steps: [
      {
        title: 'Explicabilidad',
        body: 'Cuando el motor decide, adjunta uno o más reason codes que explican la razón. Un rechazo puede llevar "FRAUDE_ALTO" o "INGRESOS_INSUFICIENTES".',
      },
      {
        title: 'Dos audiencias',
        body: 'Cada código trae un mensaje PÚBLICO (para el cliente) y uno INTERNO (para el analista). Comunicas distinto a cada audiencia con el mismo código.',
      },
      {
        title: 'Adverse action',
        body: 'Algunos códigos marcan una "acción adversa": un rechazo que legalmente debe notificarse al cliente. El catálogo lo distingue para cumplir la regulación.',
      },
    ],
  },
  'decision-graph': {
    eyebrow: 'Concepto · Fundamentos',
    title: '¿Qué es un grafo de decisión?',
    intro:
      'El árbol de decisión visual de un artefacto: cómo fluye una solicitud hasta un resultado.',
    steps: [
      {
        title: 'Nodos y rutas',
        body: 'Cada bloque (nodo) hace algo: evalúa una condición, calcula un valor o produce un resultado. Las flechas trazan la ruta que sigue una solicitud según sus datos.',
      },
      {
        title: 'Tipos de nodo',
        body: 'Inicio marca la entrada; Condición y Switch bifurcan; Expresión y Score calculan (incluso con código); Resultado y Fin cierran. Cada solicitud recorre una ruta y termina en un resultado explicado.',
      },
      {
        title: 'Por qué es visual',
        body: 'Ver el árbol permite entender y auditar la lógica sin leer código — clave para que negocio y riesgo validen la política.',
      },
    ],
  },
  deployment: {
    eyebrow: 'Concepto · Fundamentos',
    title: '¿Qué es un despliegue?',
    intro: 'Promover una versión aprobada a un ambiente para que empiece a decidir de verdad.',
    steps: [
      {
        title: 'Ambientes',
        body: 'DEV, TEST y STAGING son para probar —DEV para diseñar, TEST para la regresión, STAGING como ensayo de producción—; PROD es producción real. Un despliegue lleva una versión concreta a un ambiente concreto.',
      },
      {
        title: 'Estrategias de tráfico',
        body: 'DIRECT envía todo el tráfico a la nueva versión. CANARY y Champion lo reparten por reglas para probar gradualmente antes de ir al 100%.',
      },
      {
        title: 'Reversible y auditado',
        body: 'Cada despliegue queda registrado con quién y cuándo, y puede revertirse (rollback) si algo sale mal.',
      },
    ],
  },
  objective: {
    eyebrow: 'Concepto · Fundamentos',
    title: '¿Qué es un objetivo de negocio?',
    intro: 'Conecta una meta medible con la evidencia que la respalda.',
    steps: [
      {
        title: 'Meta más métrica',
        body: 'Define qué quieres lograr (p. ej. "reducir el fraude a menos de 0.8%") y cómo se mide.',
      },
      {
        title: 'Trazabilidad',
        body: 'Vincula el objetivo con las políticas, artefactos y pruebas que lo cumplen. Así demuestras que la meta tiene respaldo real, no solo intención.',
      },
      {
        title: 'Para el analista',
        body: 'Los objetivos te dan el "para qué" de cada artefacto: por qué existe esa decisión y qué mueve en el negocio.',
      },
    ],
  },
};

/** Ordered concept menu shown in the tutorial drawer. */
export const CONCEPTS: readonly { key: string; title: string }[] = [
  { key: 'artifact', title: 'Artefacto' },
  { key: 'variable', title: 'Variable' },
  { key: 'output-variable', title: 'Variable de salida' },
  { key: 'reason-code', title: 'Reason code' },
  { key: 'decision-graph', title: 'Grafo de decisión' },
  { key: 'nested-tree', title: 'Árbol interno' },
  { key: 'deployment', title: 'Despliegue' },
  { key: 'objective', title: 'Objetivo' },
];
