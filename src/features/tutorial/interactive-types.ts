/** Acción real que el paso espera del usuario antes de avanzar. */
export type RequiredAction = 'click' | 'input' | 'submit';

export interface InteractiveStep {
  id: string;
  /** Selector del elemento a resaltar. Preferir `[data-tutorial-id="..."]`. */
  target?: string;
  title: string;
  /** Explicación en lenguaje natural, para alguien que no programa. */
  content: string;
  /** Aparte destacado: un atajo, una consecuencia o una buena práctica. */
  tip?: string;
  /**
   * Si se define, el paso NO avanza con "Siguiente": espera a que el usuario
   * haga esa acción sobre el elemento resaltado (tutorial reactivo de verdad).
   */
  requiredAction?: RequiredAction;
  /** El paso se salta si su target no existe (funciones no disponibles). */
  optional?: boolean;
  /**
   * Ruta en la que vive este paso. Si el usuario está en otra, el motor navega
   * antes de resaltar. Sólo hace falta en los pasos que CAMBIAN de pantalla:
   * heredan la ruta del paso anterior, así que un recorrido de una sola vista
   * no necesita repetirla.
   */
  route?: string;
}

export interface InteractiveTutorial {
  /** Identificador estable, p. ej. `artifact-detail` o `error:VALIDATION_ERROR`. */
  id: string;
  title: string;
  /** Una frase: para qué sirve esta sección/flujo. */
  intro: string;
  /** Se sube cuando cambian los pasos, para re-ofrecer el tutorial. */
  version: number;
  steps: readonly InteractiveStep[];
}

/** Vínculo de un código de error a un tutorial que enseña a corregirlo. */
export interface ErrorTutorialLink {
  tutorialId: string;
  /** Título amable para la notificación (no el mensaje técnico). */
  title: string;
  description: string;
}

/** Agrupación del Centro de Tutoriales. Refleja las secciones del menú lateral. */
export type TutorialCategory =
  'introduccion' | 'diseno' | 'calidad' | 'gobierno' | 'operacion' | 'auditoria' | 'errores';

export const TUTORIAL_CATEGORY_LABELS: Readonly<Record<TutorialCategory, string>> = {
  introduccion: 'Introducción',
  diseno: 'Diseño',
  calidad: 'Calidad',
  gobierno: 'Gobierno',
  operacion: 'Operación',
  auditoria: 'Auditoría',
  errores: 'Resolver errores',
};

/** Cuánto hay que saber ya para seguir el recorrido sin perderse. */
export type TutorialLevel = 'basico' | 'intermedio' | 'avanzado';

export const TUTORIAL_LEVEL_LABELS: Readonly<Record<TutorialLevel, string>> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

/**
 * Datos de catálogo de un tutorial: lo que el Centro necesita para listarlo,
 * filtrarlo y ordenarlo, sin cargar los pasos.
 *
 * Deliberadamente NO lleva roles. Quién ve un tutorial se deriva de `route` con
 * `canAccessPath()`: duplicar aquí la tabla de permisos crearía una segunda
 * fuente de verdad que se desincronizaría en silencio del portal real.
 */
export interface TutorialMeta {
  id: string;
  category: TutorialCategory;
  level: TutorialLevel;
  /** Ruta que enseña el recorrido. De ella se deriva el permiso. */
  route?: string;
  estimatedMinutes: number;
  /** Ids de tutoriales que conviene haber hecho antes. */
  prerequisites?: readonly string[];
  /** Se ofrece de entrada a quien nunca ha usado el portal. */
  recommended?: boolean;
  /** Recorrido troncal: quien no lo ha hecho no entiende el resto. */
  essential?: boolean;
}

/** Tutorial + sus metadatos, que es lo que consume el Centro. */
export interface TutorialListing extends TutorialMeta {
  title: string;
  intro: string;
  version: number;
  stepCount: number;
}
