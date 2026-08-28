/**
 * Contrato de los workers adicionales, visto desde el portal.
 *
 * Espejo de lo que publica el Decision Engine en `/v1/workers` (ADR-0026 del
 * motor). **No es autoritativo**: el backend revalida siempre. Sirve para
 * pintar la vista y para dar respuesta inmediata antes de llamar.
 */
import type { StatementRejectionReason, StatementReviewReason } from './statement-review';

/** Estados que el backend asigna a una ejecución. */
export const WORKER_RUN_STATUSES = [
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'SUCCEEDED_WITH_WARNINGS',
  'FAILED',
  'CANCELLED',
  /*
   * Los tres desenlaces del triage de documentos. Sólo los produce el worker de
   * extractos, pero viven en la lista común porque es la del CICLO DE VIDA de
   * una ejecución, que es uno solo. Los `Record<WorkerRunStatus, …>` de abajo
   * obligan a traducirlos: un estado nuevo sin texto se pintaría con su nombre
   * técnico en mayúsculas, y eso llega a producción sin que nadie lo note.
   */
  'PENDING_REVIEW',
  'IN_REVIEW',
  'PDF_INVALID',
  /*
   * El rechazo del worker de IDENTIDAD, que faltaba aquí y el motor lleva
   * emitiendo desde que existe la puerta de documentos. Faltando en esta lista,
   * `isTerminal` lo daba por «todavía corriendo»: la consola se quedaba con la
   * barra animada en el 20 % —el progreso que el motor alcanzó antes de
   * rechazar—, sin insignia, sin el motivo que el propio motor ya había escrito
   * y sin el botón de «Nueva ejecución», sondeando cada segundo y medio una
   * ejecución cerrada hacía rato. Se leía como que el worker se colgaba.
   */
  'DOCUMENT_REJECTED',
] as const;

export type WorkerRunStatus = (typeof WORKER_RUN_STATUSES)[number];

/**
 * Estados que sólo existen en el cliente.
 *
 * Describen el formulario ANTES de que exista ninguna ejecución, así que no
 * tienen —ni deben tener— reflejo en el backend: `idle` es «no has elegido
 * nada» y `submitting` es «la petición está en vuelo». Mezclarlos con los del
 * servidor obligaría a inventar filas para estados que nunca se persisten.
 */
export type FormPhase =
  'idle' | 'selecting-example' | 'uploading' | 'validating' | 'ready' | 'submitting';

export interface WorkerRun {
  requestId: string;
  status: WorkerRunStatus;
  progress: number;
  inputSource: 'FIXTURE' | 'UPLOAD' | 'INLINE';
  fixtureCode?: string | null;
  attemptCount: number;
  queuedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  requestedBy: string;
  correlationId: string;
  result?: unknown;
  warnings?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  /**
   * Por qué espera a una persona, y por qué se rechazó. Sólo los manda el worker
   * de extractos. El estado dice DÓNDE está el caso; estos dicen QUÉ pasó, y sin
   * ellos el aviso al usuario tiene que ser genérico —«enviado a revisión»— que
   * es justo el mensaje que no informa de nada.
   */
  reviewReason?: StatementReviewReason | null;
  rejectionReason?: StatementRejectionReason | null;
  reviewPriority?: number | null;
}

export interface WorkerFixture {
  code: string;
  name: string;
  description: string;
  preview: string;
  expectsFailure: boolean;
}

/**
 * Salud de un worker, tal como la publica `GET /v1/workers/:code/metrics`.
 *
 * Espejo del DTO del motor. **No es autoritativo**, como el resto de contratos
 * de este directorio: sirve para pintar. Un `null` significa «en la ventana no
 * hubo de qué medirlo» y nunca cero, que sería una afirmación.
 */
export interface WorkerMetrics {
  worker: string;
  name: string;
  available: boolean;
  windowHours: number;
  windowFrom: string;
  computedAt: string;
  totalRuns: number;
  finishedRuns: number;
  successRate: number | null;
  statusMix: Array<{ status: WorkerRunStatus; count: number }>;
  latency: {
    p50Ms: number | null;
    p95Ms: number | null;
    p99Ms: number | null;
    maxMs: number | null;
    avgWaitMs: number | null;
    maxWaitMs: number | null;
    samples: number;
  };
  queue: { queued: number; running: number; oldestQueuedAt: string | null };
  incidents: WorkerIncident[];
  lastRunAt: string | null;
}

export interface WorkerIncident {
  code: string;
  message: string | null;
  count: number;
  lastOccurredAt: string;
  lastRequestId: string;
  lastCorrelationId: string;
  lastAttemptCount: number;
}

export interface WorkerDescriptor {
  code: string;
  name: string;
  description: string;
  acceptedInputs: string[];
  limits: Record<string, number | string>;
  available: boolean;
  fixturesEnabled: boolean;
}

/** Una ejecución en estado terminal ya no cambia: deja de sondearse. */
export function isTerminal(status: WorkerRunStatus): boolean {
  return (
    status === 'SUCCEEDED' ||
    status === 'SUCCEEDED_WITH_WARNINGS' ||
    status === 'FAILED' ||
    status === 'CANCELLED' ||
    /*
     * Los tres cuentan como terminales PARA EL SONDEO, que es lo único que decide
     * esta función. `PENDING_REVIEW` no es terminal en el dominio —lo cierra una
     * persona— pero el estado ya no cambia por sí solo, y seguir preguntando cada
     * segundo y medio por un caso que espera a alguien es sondear durante horas
     * para no ver nada.
     */
    status === 'PENDING_REVIEW' ||
    status === 'IN_REVIEW' ||
    status === 'PDF_INVALID' ||
    status === 'DOCUMENT_REJECTED'
  );
}

/**
 * Texto que ve el usuario para cada estado.
 *
 * En español y sin jerga: quien revisa un extracto no tiene por qué saber qué
 * es una cola. «En cola» describe la espera, no el mecanismo.
 */
export const STATUS_LABEL: Record<WorkerRunStatus, string> = {
  QUEUED: 'En cola',
  RUNNING: 'Procesando',
  SUCCEEDED: 'Completado',
  SUCCEEDED_WITH_WARNINGS: 'Completado con advertencias',
  FAILED: 'Falló',
  CANCELLED: 'Cancelado',
  PENDING_REVIEW: 'Pendiente de revisión',
  IN_REVIEW: 'En revisión',
  PDF_INVALID: 'PDF no válido',
  DOCUMENT_REJECTED: 'Documento rechazado',
};

/**
 * Explica qué significa el estado y, cuando procede, qué se puede hacer.
 *
 * «Completado con advertencias» es el que más falta hace: sin esta frase, un
 * usuario lo lee como un éxito y no mira el resultado, que es justo lo que hay
 * que evitar.
 */
export const STATUS_HELP: Record<WorkerRunStatus, string> = {
  QUEUED: 'Esperando a que un worker la tome. Puedes cancelarla mientras siga aquí.',
  RUNNING: 'Un worker la está procesando ahora mismo.',
  SUCCEEDED: 'Terminó sin incidencias.',
  SUCCEEDED_WITH_WARNINGS:
    'Hay resultado y es utilizable, pero algo quedó sin resolver del todo. Conviene revisarlo antes de darlo por bueno.',
  FAILED: 'No se pudo completar. El código técnico y el identificador de correlación están abajo.',
  CANCELLED: 'Se canceló antes de empezar a procesarse.',
  PENDING_REVIEW:
    'El documento parece un extracto y algo no se pudo determinar con seguridad. Está en la cola de revisión y puedes seguir trabajando.',
  IN_REVIEW: 'Alguien lo está revisando ahora mismo.',
  PDF_INVALID:
    'El documento no corresponde a un extracto bancario. No entra en la cola de revisión: queda registrado como rechazado.',
  /*
   * Dice «vuelve a intentarlo» a propósito: a diferencia de `FAILED`, aquí no se
   * averió nada y repetir con la misma imagen dará el mismo rechazo. Lo que hay
   * que cambiar es la foto, y el motivo exacto lo escribe el motor debajo.
   */
  DOCUMENT_REJECTED:
    'La imagen no es un documento de identidad que este worker admita. No entra en la cola de revisión: nadie tiene que mirarla. Envía otra foto para volver a intentarlo.',
};

/**
 * Traduce el estado a un valor que `StatusBadge` ya sabe colorear.
 *
 * No se inventan tonos nuevos: la insignia deriva el color de un vocabulario
 * cerrado (`PASSED`, `WARNING`, `FAILED`…), y un valor fuera de él cae en
 * «neutral» sin avisar. `SUCCEEDED` viaja como `PASSED` justamente por eso —
 * `COMPLETED` no está en ese vocabulario y saldría gris, que es el color de
 * «no pasa nada aquí».
 */
export function statusTone(status: WorkerRunStatus): string {
  if (status === 'SUCCEEDED') return 'PASSED';
  if (status === 'SUCCEEDED_WITH_WARNINGS') return 'WARNING';
  if (status === 'FAILED') return 'FAILED';
  if (status === 'CANCELLED') return 'INACTIVE';
  if (status === 'RUNNING') return 'RUNNING';
  /*
   * Esperar a una persona es ÁMBAR, no rojo: no ha fallado nada y pintarlo de
   * rojo entrena a leer la cola como una lista de errores. El rechazo sí es rojo
   * —es una negativa— y usa `INVALID`, que el vocabulario de la insignia ya
   * colorea como peligro.
   */
  if (status === 'PENDING_REVIEW' || status === 'IN_REVIEW') return 'REVIEW';
  if (status === 'PDF_INVALID' || status === 'DOCUMENT_REJECTED') return 'INVALID';
  return 'QUEUED';
}

/**
 * Duración legible entre dos instantes. `null` cuando aún no ha empezado.
 *
 * Sube de unidad al pasar la hora y el día. Se quedaba en minutos, y el
 * historial de un worker llega a semanas: «hace 1052 min 13 s» obliga a dividir
 * mentalmente por 60 para enterarse de que fue ayer.
 */
export function elapsedLabel(from: string | null | undefined, to?: string | null): string | null {
  if (!from) return null;
  const start = Date.parse(from);
  if (Number.isNaN(start)) return null;
  const end = to ? Date.parse(to) : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1_000));
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}
