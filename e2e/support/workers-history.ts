/**
 * Historial de ejecuciones del motor simulado: lo que sostiene el panel de control.
 *
 * Sin esto, `GET /runs` devolvería una página vacía y el panel sólo pintaría
 * sus estados vacíos: se estaría midiendo «no hay nada» creyendo medir la
 * salud, la latencia, la cola y las incidencias.
 *
 * Por eso hay de todo, y a propósito: dos terminadas con duraciones distintas
 * (12 s y 2 s, para que el gráfico tenga forma), una esperando turno, una
 * procesándose con progreso a medias, y **dos fallos con el mismo código de
 * error** — que es lo que obliga al panel a agrupar por causa en vez de
 * enumerar, que era el punto.
 */
const BASE = {
  inputSource: 'FIXTURE',
  fixtureCode: 'valid-basic',
  attemptCount: 1,
  requestedBy: 'pablo@atlas',
  errorCode: null,
  errorMessage: null,
};

const ROWS = [
  {
    requestId: 'run-en-cola',
    status: 'QUEUED',
    progress: 0,
    queuedAt: '2026-08-04T10:20:00.000Z',
    startedAt: null,
    finishedAt: null,
  },
  {
    requestId: 'run-en-proceso',
    status: 'RUNNING',
    progress: 45,
    queuedAt: '2026-08-04T10:19:00.000Z',
    startedAt: '2026-08-04T10:19:02.000Z',
    finishedAt: null,
  },
  {
    requestId: 'run-fallida-2',
    status: 'FAILED',
    progress: 100,
    queuedAt: '2026-08-04T10:15:00.000Z',
    startedAt: '2026-08-04T10:15:01.000Z',
    finishedAt: '2026-08-04T10:15:04.000Z',
    errorCode: 'DOCUMENTO_ILEGIBLE',
    errorMessage: 'El documento no tiene una capa de texto legible.',
  },
  {
    requestId: 'run-fallida-1',
    status: 'FAILED',
    progress: 100,
    queuedAt: '2026-08-04T10:10:00.000Z',
    startedAt: '2026-08-04T10:10:01.000Z',
    finishedAt: '2026-08-04T10:10:05.000Z',
    errorCode: 'DOCUMENTO_ILEGIBLE',
    errorMessage: 'El documento no tiene una capa de texto legible.',
  },
  {
    requestId: 'run-lenta',
    status: 'SUCCEEDED',
    progress: 100,
    queuedAt: '2026-08-04T10:05:00.000Z',
    startedAt: '2026-08-04T10:05:01.000Z',
    finishedAt: '2026-08-04T10:05:13.000Z',
  },
  {
    requestId: 'run-rapida',
    status: 'SUCCEEDED_WITH_WARNINGS',
    progress: 100,
    queuedAt: '2026-08-04T10:00:00.000Z',
    startedAt: '2026-08-04T10:00:01.000Z',
    finishedAt: '2026-08-04T10:00:03.000Z',
  },
];

export const WORKER_HISTORY = ROWS.map((row) => ({
  ...BASE,
  correlationId: `corr-${row.requestId}`,
  ...row,
}));

/**
 * Salud del worker, tal como la calcula el motor sobre ese mismo historial.
 *
 * Se escribe a mano y no se deriva de `WORKER_HISTORY` a propósito: si el
 * simulado calculara las cifras con la misma aritmética que la vista, la prueba
 * comprobaría que dos copias del mismo cálculo coinciden. Escribiéndolas se
 * comprueba lo que de verdad importa —que la vista pinta LO QUE EL MOTOR DICE—,
 * y una vista que decidiera recalcularlas por su cuenta fallaría aquí.
 */
export const WORKER_METRICS = {
  worker: 'bank-statement',
  name: 'Extractos bancarios',
  available: true,
  windowHours: 168,
  windowFrom: '2026-07-28T10:00:00.000Z',
  computedAt: '2026-08-04T10:20:00.000Z',
  totalRuns: 6,
  finishedRuns: 4,
  successRate: 50,
  statusMix: [
    { status: 'FAILED', count: 2 },
    { status: 'SUCCEEDED', count: 1 },
    { status: 'SUCCEEDED_WITH_WARNINGS', count: 1 },
    { status: 'RUNNING', count: 1 },
    { status: 'QUEUED', count: 1 },
  ],
  latency: {
    p50Ms: 4_500,
    p95Ms: 11_650,
    p99Ms: 11_930,
    maxMs: 12_000,
    avgWaitMs: 1_250,
    maxWaitMs: 2_000,
    samples: 4,
  },
  queue: { queued: 1, running: 1, oldestQueuedAt: '2026-08-04T10:20:00.000Z' },
  incidents: [
    {
      code: 'DOCUMENTO_ILEGIBLE',
      message: 'El documento no tiene una capa de texto legible.',
      count: 2,
      lastOccurredAt: '2026-08-04T10:15:00.000Z',
      lastRequestId: 'run-fallida-2',
      lastCorrelationId: 'corr-run-fallida-2',
      lastAttemptCount: 1,
    },
  ],
  lastRunAt: '2026-08-04T10:20:00.000Z',
};
