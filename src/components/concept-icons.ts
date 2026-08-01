import {
  Activity,
  BookOpen,
  Boxes,
  Braces,
  CircleAlert,
  ClipboardCheck,
  Cloud,
  Database,
  FileCode2,
  FileSearch,
  FlaskConical,
  Goal,
  GraduationCap,
  Layers,
  ListChecks,
  LogIn,
  LogOut,
  Play,
  Radio,
  ScanSearch,
  ScrollText,
  Server,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

/**
 * Catálogo central de conceptos del dominio.
 *
 * Un concepto es "de qué habla la interfaz" (un algoritmo, una suite, un
 * ambiente), a diferencia de `action-catalog.ts`, que describe "qué puedes
 * hacer" (ver, editar, publicar). Menús, pestañas, encabezados, tarjetas,
 * tablas, estados vacíos y nodos del grafo leen de aquí, de modo que el mismo
 * concepto se dibuja siempre con el mismo icono y se explica con las mismas
 * palabras en toda la plataforma.
 *
 * Cada entrada aporta el texto que necesita la accesibilidad: `label` alimenta
 * el `aria-label` y `hint` el tooltip explicativo.
 */
export interface ConceptDefinition {
  icon: LucideIcon;
  label: string;
  /** Explicación en lenguaje llano; se muestra como tooltip. */
  hint: string;
}

export const CONCEPTS = {
  algorithm: {
    icon: Workflow,
    label: 'Algoritmo',
    hint: 'Diagrama de decisión que la plataforma ejecuta para resolver un caso.',
  },
  decisionTree: {
    icon: Workflow,
    label: 'Árbol de decisión',
    hint: 'Recorrido de nodos donde cada camino termina en un resultado.',
  },
  artifact: {
    icon: Boxes,
    label: 'Artefacto',
    hint: 'Agrupa todas las versiones de un mismo algoritmo de decisión.',
  },
  version: {
    icon: Layers,
    label: 'Versión',
    hint: 'Fotografía inmutable de un algoritmo en un momento dado.',
  },
  inputVariable: {
    icon: LogIn,
    label: 'Variable de entrada',
    hint: 'Dato que el algoritmo recibe antes de decidir.',
  },
  outputVariable: {
    icon: LogOut,
    label: 'Variable de salida',
    hint: 'Dato que el algoritmo devuelve cuando termina.',
  },
  variableCatalog: {
    icon: Database,
    label: 'Catálogo de variables',
    hint: 'Definición compartida de los datos que usan los algoritmos.',
  },
  reasonCode: {
    icon: Braces,
    label: 'Reason code',
    hint: 'Motivo normalizado que justifica un resultado ante el cliente.',
  },
  testSuite: {
    icon: FlaskConical,
    label: 'Suite de prueba',
    hint: 'Conjunto de casos relacionados que se ejecutan juntos.',
  },
  testCase: {
    icon: ListChecks,
    label: 'Caso de prueba',
    hint: 'Entrada concreta y el resultado que se espera obtener.',
  },
  testing: {
    icon: FlaskConical,
    label: 'Pruebas',
    hint: 'Validación automática del comportamiento antes de publicar.',
  },
  coverage: {
    icon: ShieldCheck,
    label: 'Cobertura',
    hint: 'Qué parte del algoritmo llegan a recorrer las pruebas.',
  },
  execution: {
    icon: Play,
    label: 'Ejecución',
    hint: 'Una decisión real ya resuelta, con su recorrido completo.',
  },
  liveExecution: {
    icon: Radio,
    label: 'Ejecución en vivo',
    hint: 'Seguimiento nodo por nodo mientras el motor decide.',
  },
  simulation: {
    icon: Play,
    label: 'Simulación',
    hint: 'Ejecución de prueba que no se registra como decisión real.',
  },
  environment: {
    icon: Server,
    label: 'Ambiente',
    hint: 'Espacio aislado donde corre una versión: sandbox, test o producción.',
  },
  deployment: {
    icon: Cloud,
    label: 'Despliegue',
    hint: 'Publicación de una versión en un ambiente concreto.',
  },
  logs: {
    icon: ScrollText,
    label: 'Bitácora',
    hint: 'Registro cronológico e inalterable de lo que ocurrió.',
  },
  audit: {
    icon: FileSearch,
    label: 'Auditoría',
    hint: 'Consulta de decisiones pasadas y sus evidencias.',
  },
  tutorial: {
    icon: GraduationCap,
    label: 'Tutorial',
    hint: 'Recorrido guiado que explica cómo usar esta herramienta.',
  },
  learning: {
    icon: BookOpen,
    label: 'Centro de aprendizaje',
    hint: 'Material de apoyo para entender la plataforma.',
  },
  user: {
    icon: UserRound,
    label: 'Usuario',
    hint: 'Persona con acceso a la plataforma.',
  },
  team: {
    icon: Users,
    label: 'Equipo',
    hint: 'Grupo de personas que comparte responsabilidades y permisos.',
  },
  risk: {
    icon: ShieldAlert,
    label: 'Riesgo',
    hint: 'Evaluación del nivel de exposición de una operación.',
  },
  manualReview: {
    icon: ScanSearch,
    label: 'Revisión manual',
    hint: 'Paso en el que una persona revisa el caso antes de resolverlo.',
  },
  approval: {
    icon: ClipboardCheck,
    label: 'Aprobación',
    hint: 'Autorización requerida para que una versión avance.',
  },
  objective: {
    icon: Goal,
    label: 'Objetivo de negocio',
    hint: 'Meta que la decisión automatizada debe cumplir.',
  },
  health: {
    icon: Activity,
    label: 'Estado de plataforma',
    hint: 'Disponibilidad de los servicios que sostienen las decisiones.',
  },
  code: {
    icon: FileCode2,
    label: 'Código',
    hint: 'Lógica escrita en JavaScript o Python dentro de un nodo.',
  },
  alert: {
    icon: CircleAlert,
    label: 'Alerta',
    hint: 'Situación que requiere atención de una persona.',
  },
} as const satisfies Record<string, ConceptDefinition>;

export type ConceptKey = keyof typeof CONCEPTS;

/** Devuelve la definición de un concepto; útil desde datos dinámicos. */
export function concept(key: ConceptKey): ConceptDefinition {
  return CONCEPTS[key];
}
