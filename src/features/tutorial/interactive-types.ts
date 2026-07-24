export type RequiredAction = 'click';

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
