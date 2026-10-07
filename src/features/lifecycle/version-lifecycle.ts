/**
 * Qué se puede hacer con una versión, según el estado en que está.
 *
 * La regla vive en el motor (`ArtifactLifecycleService`): sólo se valida lo que
 * está en `DRAFT`, `VALIDATION_FAILED` o `VALIDATED`, y **sólo se compila lo que
 * está `VALIDATED`**. Aquí se refleja para poder decirlo ANTES de pulsar, no
 * para decidirlo: el motor rechaza igual si esta tabla se quedara vieja.
 *
 * Existe porque el asistente ofrecía «Compilar» siempre y, sobre una versión ya
 * compilada, devolvía «Está desplegada o retirada: crea una versión nueva» —una
 * explicación falsa, porque la versión no estaba ni desplegada ni retirada: ya
 * estaba compilada y ése era todo el problema—.
 */

/**
 * Estados que publica el motor para una versión de artefacto (`enum VersionStatus` de su esquema).
 *
 * Hasta 2026-10 esta lista era otra (`PENDING_APPROVAL`, `DEPLOYED`), que el motor no emite: una versión
 * `IN_REVIEW`, `REJECTED` o `DEPLOYED_TO_STAGING` no encajaba en ningún paso y el asistente respondía «elige
 * una versión» con la versión ya elegida.
 */
export const VERSION_STATUSES = [
  'DRAFT',
  'VALIDATION_FAILED',
  'VALIDATED',
  'COMPILED',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'REJECTED',
  'APPROVED',
  'DEPLOYED_TO_DEV',
  'DEPLOYED_TO_TEST',
  'DEPLOYED_TO_STAGING',
  'DEPLOYED_TO_PROD',
  'SUSPENDED',
  'RETIRED',
] as const;

export type VersionStatus = (typeof VERSION_STATUSES)[number];

export interface LifecycleStep {
  id: string;
  label: string;
  /** Qué pasa en este paso, en una línea: se muestra bajo el nombre cuando todavía no se llegó. */
  what: string;
  /** Estados que pertenecen a este paso. */
  statuses: readonly VersionStatus[];
}

/**
 * El recorrido, en el orden en que ocurre.
 *
 * Seis pasos: la REVISIÓN es uno propio. Antes el recorrido saltaba de «Compilada» a «Aprobada y desplegada», y
 * con una versión recién compilada no se veía que lo que toca es enviarla a que la firmen dos personas —el paso
 * que más se olvida—. `VALIDATION_FAILED` no es un paso sino la validación que salió mal; `CHANGES_REQUESTED` y
 * `REJECTED` son la revisión que no salió.
 */
export const LIFECYCLE_STEPS: readonly LifecycleStep[] = [
  {
    id: 'draft',
    label: 'Diseño',
    what: 'Se edita el diagrama.',
    statuses: ['DRAFT', 'VALIDATION_FAILED'],
  },
  {
    id: 'validated',
    label: 'Validada',
    what: 'El motor comprueba el diagrama.',
    statuses: ['VALIDATED'],
  },
  {
    id: 'compiled',
    label: 'Compilada',
    what: 'Se genera lo que el motor ejecuta.',
    statuses: ['COMPILED'],
  },
  {
    id: 'review',
    label: 'Revisión',
    what: 'La firman Calidad, Riesgo y Cumplimiento.',
    statuses: ['IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED'],
  },
  { id: 'approved', label: 'Aprobada', what: 'Lista para desplegar.', statuses: ['APPROVED'] },
  {
    id: 'deployed',
    label: 'Desplegada',
    what: 'Decide solicitudes reales en un ambiente.',
    statuses: [
      'DEPLOYED_TO_DEV',
      'DEPLOYED_TO_TEST',
      'DEPLOYED_TO_STAGING',
      'DEPLOYED_TO_PROD',
      'SUSPENDED',
      'RETIRED',
    ],
  },
];

/** Lo que el asistente puede ofrecer a continuación, además de validar y compilar. */
export type LifecycleNextStep =
  'edit' | 'submit-review' | 'follow-review' | 'deploy' | 'new-version' | null;

export interface LifecycleGuidance {
  /** Índice del paso actual; -1 mientras no se conoce el estado. */
  stepIndex: number;
  canValidate: boolean;
  canCompile: boolean;
  /** Qué significa este estado, en una frase. */
  summary: string;
  /** Qué corresponde hacer ahora. */
  nextAction: string;
  /** Tono con el que se anuncia: no todo estado es un problema. */
  tone: 'info' | 'success' | 'warning';
  /** La acción que el asistente pone a mano para ese «qué corresponde hacer». */
  next: LifecycleNextStep;
}

const VALIDATABLE: readonly VersionStatus[] = ['DRAFT', 'VALIDATION_FAILED', 'VALIDATED'];

type Guidance = Omit<LifecycleGuidance, 'stepIndex' | 'canValidate' | 'canCompile'>;

const DESPLEGADA: Guidance = {
  summary: 'Está desplegada: hay decisiones ejecutándose con ella.',
  // Aquí SÍ es cierto lo de «crea una versión nueva».
  nextAction: 'Queda congelada para que sea auditable. Los cambios van en una versión nueva.',
  tone: 'info',
  next: 'new-version',
};

const GUIDANCE: Record<VersionStatus, Guidance> = {
  DRAFT: {
    summary: 'Está en diseño: se puede editar y todavía no se ha comprobado.',
    nextAction: 'Valídala para que el motor revise el diagrama y fije su huella.',
    tone: 'info',
    next: 'edit',
  },
  VALIDATION_FAILED: {
    summary: 'La última validación encontró errores que impiden compilar.',
    nextAction: 'Corrige lo señalado abajo en el editor y vuelve a validar.',
    tone: 'warning',
    next: 'edit',
  },
  VALIDATED: {
    summary: 'El diagrama pasó la validación y su huella está fijada.',
    nextAction: 'Compílala para producir lo que ejecuta el motor.',
    tone: 'success',
    next: null,
  },
  COMPILED: {
    summary: 'Ya está compilada: existe lo que el motor ejecuta, pero todavía no decide nada.',
    // Compilar de nuevo no aporta nada —el resultado sería idéntico— y por eso el motor lo rechaza;
    // lo que falta es el trámite de gobierno, y se ofrece aquí mismo.
    nextAction:
      'No hace falta compilar otra vez. El paso que sigue es la revisión: envíala para que la firmen Calidad, Riesgo y Cumplimiento. Necesita sus pruebas bloqueantes en verde.',
    tone: 'success',
    next: 'submit-review',
  },
  IN_REVIEW: {
    summary: 'Está en revisión: espera las firmas de quienes aprueban.',
    nextAction:
      'Sigue la solicitud en Revisiones; el diagrama ya no debe cambiar. Tú no puedes aprobar la tuya.',
    tone: 'info',
    next: 'follow-review',
  },
  CHANGES_REQUESTED: {
    summary: 'La revisión pidió cambios.',
    nextAction:
      'Lee los comentarios en Revisiones y crea una versión nueva desde ésta para corregirla.',
    tone: 'warning',
    next: 'new-version',
  },
  REJECTED: {
    summary: 'La revisión la rechazó: esta versión no se desplegará.',
    nextAction: 'Queda como registro. Si el cambio sigue haciendo falta, va en una versión nueva.',
    tone: 'warning',
    next: 'new-version',
  },
  APPROVED: {
    summary: 'Aprobada por dos personas y lista para desplegarse en un ambiente.',
    nextAction: 'Créale un despliegue desde Despliegues: hasta entonces no decide nada.',
    tone: 'success',
    next: 'deploy',
  },
  DEPLOYED_TO_DEV: DESPLEGADA,
  DEPLOYED_TO_TEST: DESPLEGADA,
  DEPLOYED_TO_STAGING: DESPLEGADA,
  DEPLOYED_TO_PROD: DESPLEGADA,
  SUSPENDED: {
    summary: 'Está suspendida: se desplegó y se detuvo.',
    nextAction: 'Los cambios van en una versión nueva.',
    tone: 'warning',
    next: 'new-version',
  },
  RETIRED: {
    summary: 'Está retirada: se conserva como registro y ya no se ejecuta.',
    nextAction: 'Los cambios van en una versión nueva.',
    tone: 'info',
    next: 'new-version',
  },
};

/** Qué se puede hacer con la versión, y qué decirle a quien la mira. */
export function lifecycleGuidance(status: string | undefined): LifecycleGuidance {
  if (!status || !isVersionStatus(status)) {
    return {
      stepIndex: -1,
      canValidate: false,
      canCompile: false,
      summary: 'Elige una versión para ver en qué punto del recorrido está.',
      nextAction: 'El asistente sólo ofrece lo que su estado admite.',
      tone: 'info',
      next: null,
    };
  }
  return {
    stepIndex: LIFECYCLE_STEPS.findIndex((step) => step.statuses.includes(status)),
    canValidate: VALIDATABLE.includes(status),
    canCompile: status === 'VALIDATED',
    ...GUIDANCE[status],
  };
}

export function isVersionStatus(value: string): value is VersionStatus {
  return (VERSION_STATUSES as readonly string[]).includes(value);
}
