import type { TutorialRegistry } from './tutorial.types';

/** "El motor de decisión" — the authoring tools under Diseño. */
export const engineTutorials: TutorialRegistry = {
  '/variables': {
    eyebrow: 'Motor de decisión · Diseño',
    title: 'Catálogo de Variables',
    intro:
      'Define los datos versionados que tus reglas, modelos y grafos de decisión pueden consumir.',
    steps: [
      {
        title: 'Qué es una variable',
        body: 'Cada variable es un dato de entrada o salida con un código estable (p. ej. monthly_income), un tipo y una clasificación. El motor solo puede usar variables declaradas aquí.',
      },
      {
        title: 'Crear una variable',
        body: 'Pulsa «Add Variable», elige un código, su tipo de dato y su clasificación. Los campos de catálogo sugieren valores existentes, pero puedes escribir uno nuevo al vuelo.',
        tip: 'Marca «Dato sensible» si contiene PII: el motor la tratará con controles reforzados.',
      },
      {
        title: 'Versionado seguro',
        body: 'Una variable nace con su versión inicial. Cambiar su contrato crea una versión nueva sin romper los artefactos que ya usan la anterior.',
      },
      {
        title: 'Buscar en catálogos grandes',
        body: 'Filtra por código o nombre desde la barra de búsqueda para ubicar una variable entre cientos.',
      },
    ],
  },
  '/reason-codes': {
    eyebrow: 'Motor de decisión · Diseño',
    title: 'Catálogo de Reason Codes',
    intro: 'Los motivos explicables que acompañan cada decisión de crédito, fraude o cumplimiento.',
    steps: [
      {
        title: 'Para qué sirven',
        body: 'Cuando el motor aprueba o rechaza, adjunta uno o más reason codes. Son la base de la explicabilidad y de los avisos de adverse action.',
      },
      {
        title: 'Crear un reason code',
        body: 'Pulsa «Add Reason Code» y define código, categoría, severidad y dos mensajes: uno público para el cliente y uno interno para analistas.',
        tip: 'Marca «Adverse action» si el código puede aparecer en una notificación legal de decisión adversa.',
      },
      {
        title: 'Organizar y priorizar',
        body: 'Agrupa por categoría (KYC, FRAUD, CREDIT…) y severidad para filtrar y priorizar en el análisis posterior.',
      },
    ],
  },
  '/artifacts': {
    eyebrow: 'Motor de decisión · Diseño',
    title: 'Inventario de Artefactos',
    intro:
      'Un artefacto es una unidad de decisión versionable: su grafo, sus reglas y su contrato.',
    steps: [
      {
        title: 'El ciclo de vida',
        body: 'Un artefacto avanza por borrador → validación → aprobación → despliegue. Cada versión queda inmutable una vez publicada.',
      },
      {
        title: 'Crear un artefacto',
        body: 'Pulsa «Nuevo Artefacto» y define código, tipo, equipo responsable, propósito de negocio y dominio de riesgo.',
      },
      {
        title: 'Abrir el detalle',
        body: 'Haz clic en un artefacto para ver sus versiones, estado actual e historial, y saltar a su grafo de decisión.',
      },
    ],
  },
  '/graph-editor': {
    eyebrow: 'Motor de decisión · Diseño',
    title: 'Editor de Grafo',
    intro: 'El lienzo donde construyes visualmente el algoritmo de decisión de una versión.',
    steps: [
      {
        title: 'Cargar una versión',
        body: 'Elige la versión del artefacto en la barra superior y pulsa «Cargar» para traer su grafo al lienzo.',
      },
      {
        title: 'Añadir bloques',
        body: 'Arrastra desde la paleta: Inicio, Condición, Switch, y en «Cálculo con código» los nodos Expresión y Score, donde escribes lógica en JavaScript o Python.',
        tip: 'Los chips de variables insertan la referencia correcta: variables.x en JS, variables["x"] en Python.',
      },
      {
        title: 'Conectar y validar',
        body: 'Activa «Conectar» para unir bloques y usa «Validar» antes de guardar: detecta rutas incompletas, nodos huérfanos y ciclos prohibidos.',
      },
      {
        title: 'Guardar con control de versión',
        body: '«Guardar» persiste el grafo con bloqueo optimista. Si alguien más editó la misma versión, te avisará del conflicto en lugar de sobrescribir.',
      },
    ],
  },
};
