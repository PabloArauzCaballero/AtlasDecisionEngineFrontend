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

/** Estados que publica el motor para una versión de artefacto. */
export const VERSION_STATUSES = [
  'DRAFT',
  'VALIDATION_FAILED',
  'VALIDATED',
  'COMPILED',
  'PENDING_APPROVAL',
  'APPROVED',
  'DEPLOYED',
  'RETIRED',
] as const;

export type VersionStatus = (typeof VERSION_STATUSES)[number];

export interface LifecycleStep {
  id: string;
  label: string;
  /** Estados que pertenecen a este paso. */
  statuses: readonly VersionStatus[];
}

/**
 * El recorrido, en el orden en que ocurre.
 *
 * Cuatro pasos y no los ocho estados: `VALIDATION_FAILED` no es un paso propio
 * sino la validación que salió mal, y `PENDING_APPROVAL`/`APPROVED` son dos
 * momentos del mismo trámite. Un indicador con un paso por estado obligaría a
 * leerlos todos para saber por dónde va.
 */
export const LIFECYCLE_STEPS: readonly LifecycleStep[] = [
  { id: 'draft', label: 'Diseño', statuses: ['DRAFT', 'VALIDATION_FAILED'] },
  { id: 'validated', label: 'Validada', statuses: ['VALIDATED'] },
  { id: 'compiled', label: 'Compilada', statuses: ['COMPILED'] },
  {
    id: 'governed',
    label: 'Aprobada y desplegada',
    statuses: ['PENDING_APPROVAL', 'APPROVED', 'DEPLOYED', 'RETIRED'],
  },
];

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
}

const VALIDATABLE: readonly VersionStatus[] = ['DRAFT', 'VALIDATION_FAILED', 'VALIDATED'];

const GUIDANCE: Record<
  VersionStatus,
  Omit<LifecycleGuidance, 'stepIndex' | 'canValidate' | 'canCompile'>
> = {
  DRAFT: {
    summary: 'Está en diseño: se puede editar y todavía no se ha comprobado.',
    nextAction: 'Valídala para que el motor revise el grafo y fije su checksum.',
    tone: 'info',
  },
  VALIDATION_FAILED: {
    summary: 'La última validación encontró errores que impiden compilar.',
    nextAction: 'Corrige lo señalado abajo en el editor y vuelve a validar.',
    tone: 'warning',
  },
  VALIDATED: {
    summary: 'El grafo pasó la validación y su checksum está fijado.',
    nextAction: 'Compílala para producir el artefacto que ejecuta el motor.',
    tone: 'success',
  },
  COMPILED: {
    summary: 'Ya está compilada: existe el artefacto que el motor ejecuta.',
    // Esto es lo que el mensaje anterior no decía. Compilar de nuevo no aporta
    // nada —el resultado sería idéntico, el checksum es el mismo— y por eso el
    // motor lo rechaza; lo que falta es el trámite de gobierno.
    nextAction: 'No hace falta compilar otra vez. Envíala a revisión para aprobarla y desplegarla.',
    tone: 'success',
  },
  PENDING_APPROVAL: {
    summary: 'Está esperando la decisión de quien aprueba.',
    nextAction: 'Sigue la solicitud en Revisiones; el grafo ya no debe cambiar.',
    tone: 'info',
  },
  APPROVED: {
    summary: 'Aprobada y lista para desplegarse en un ambiente.',
    nextAction: 'Créale un despliegue desde Despliegues.',
    tone: 'success',
  },
  DEPLOYED: {
    summary: 'Está desplegada: hay decisiones reales ejecutándose con ella.',
    // Aquí SÍ es cierto lo de «crea una versión nueva», y sólo aquí.
    nextAction: 'Queda congelada para que sea auditable. Los cambios van en una versión nueva.',
    tone: 'info',
  },
  RETIRED: {
    summary: 'Está retirada: se conserva como registro y ya no se ejecuta.',
    nextAction: 'Los cambios van en una versión nueva.',
    tone: 'info',
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
