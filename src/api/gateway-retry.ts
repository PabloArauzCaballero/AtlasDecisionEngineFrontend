import { ApiError } from './ApiError';

/**
 * Reintento de lo que falla porque el servicio no estaba, no porque dijera que no.
 *
 * ## Por qué existe
 *
 * Cada despliegue deja el servicio de aguas abajo sin servir mientras Coolify cambia los
 * contenedores: para los viejos antes de levantar los nuevos, y entre medias nadie responde a
 * `motor` ni a `atlas-backend`. Medido el 2026-09-13 en AtlasBackend: 77 s antes de ajustar el
 * compose, 12-36 s después, varias veces al día.
 *
 * ## Aquí la pasarela SÍ se identifica, y por eso la regla es distinta
 *
 * En los otros portales hay que adivinar quién contestó mirando si el cuerpo es JSON. Este portal
 * tiene sus propios proxys de servidor (`src/server/*-proxy.ts`), que ya traducen el fallo a un
 * código propio, y esa distinción es justo la que decide si repetir es seguro:
 *
 *  - `*_UNAVAILABLE` (502): el proxy no llegó a conectar. La petición NO se ejecutó.
 *  - `*_TIMEOUT` (504): conectó y no le contestaron a tiempo. La petición PUDO ejecutarse.
 *
 * `PDF_WORKER_UNAUTHORIZED` también es un 502, y no se repite: es una variable de entorno mal
 * puesta en el servidor, y repetirla 45 s sólo retrasa el mensaje que dice dónde mirar.
 *
 * Si el que se está desplegando es este mismo portal, el que contesta es Traefik con
 * `404 page not found` en texto plano: un 404/5xx que no es JSON tampoco lo escribió el API.
 *
 * ## Qué se repite
 *
 *  - GET/HEAD: cualquier fallo transitorio, incluido el corte de red (el plazo agotado NO: ver
 *    `outageOfError`).
 *  - El resto: sólo lo que NO llegó. Nunca un timeout ni un corte, porque ahí la ejecución pudo
 *    ocurrir sin que volviera la respuesta.
 */

export const RETRY_BUDGET_MS = 45_000;

const DELAYS_MS = [1_000, 2_000, 3_000, 5_000, 8_000];

/** Dispersión: al acabar un despliegue no vuelven todas las pestañas en el mismo instante. */
const JITTER = 0.25;

/** Códigos con los que los proxys de este portal dicen «no pude conectar». */
const UNAVAILABLE_CODES = new Set(['DECISION_ENGINE_UNAVAILABLE', 'ATLAS_BACKEND_UNAVAILABLE']);

/** Códigos con los que dicen «conecté y no contestó a tiempo». */
const TIMEOUT_CODES = new Set(['DECISION_ENGINE_TIMEOUT', 'ATLAS_BACKEND_TIMEOUT']);

/** Estados que, sin cuerpo JSON, sólo puede poner lo que está delante del portal. */
const INFRA_STATUSES = new Set([404, 500, 502, 503, 504]);

export type Outage =
  /** Seguro que no se ejecutó: repetir no puede duplicar nada. */
  | 'not-delivered'
  /** Pudo ejecutarse: sólo se repite si la operación es de lectura. */
  | 'maybe-delivered';

export type RetryMode = 'safe' | 'undelivered-only';

export function retryModeFor(method: string | undefined): RetryMode {
  const normalized = (method ?? 'GET').toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD' ? 'safe' : 'undelivered-only';
}

/**
 * Clasifica una respuesta. Devuelve `null` si la escribió el servicio de verdad.
 *
 * Lee el cuerpo de un CLON: la respuesta se devuelve intacta a quien la pidió.
 */
export async function outageOf(response: Response): Promise<Outage | null> {
  if (!INFRA_STATUSES.has(response.status)) return null;

  const isJson = (response.headers.get('content-type') ?? '').includes('json');
  if (!isJson) return 'not-delivered';

  const code = await readCode(response);
  if (code && UNAVAILABLE_CODES.has(code)) return 'not-delivered';
  if (code && TIMEOUT_CODES.has(code)) return 'maybe-delivered';
  return null;
}

async function readCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.clone().json();
    const code = (body as { code?: unknown } | null)?.code;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

/**
 * Un fallo sin respuesta. Sólo cuenta el corte de red.
 *
 * El plazo agotado NO se repite, y la diferencia es de quién es el reloj: éste lo mide el navegador
 * contra el PORTAL, que es el mismo origen que sirvió la página. Que el portal tarde no dice que el
 * servicio de aguas abajo se esté desplegando —para eso está el 504 con `*_TIMEOUT`, que sí se
 * clasifica—, y repetirlo convierte un endpoint lento en 45 s de espera antes de enseñar el error.
 */
export function outageOfError(error: unknown): Outage | null {
  if (!(error instanceof ApiError)) return null;
  return error.kind === 'network' ? 'maybe-delivered' : null;
}

export function deservesRetry(outage: Outage | null, mode: RetryMode): boolean {
  if (outage === null) return false;
  return mode === 'safe' || outage === 'not-delivered';
}

export function delayBeforeAttempt(attempt: number, random: () => number = Math.random): number {
  const base = DELAYS_MS[Math.min(attempt - 1, DELAYS_MS.length - 1)] as number;
  return Math.round(base * (1 - JITTER + random() * JITTER * 2));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new ApiError('La solicitud fue cancelada.', 499, 'REQUEST_ABORTED', undefined, 'cancelled'),
      );
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(
        new ApiError('La solicitud fue cancelada.', 499, 'REQUEST_ABORTED', undefined, 'cancelled'),
      );
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Envía y repite mientras el fallo lo merezca y quede presupuesto.
 *
 * Al agotarse devuelve la ÚLTIMA respuesta —o relanza el último error— para que el flujo de siempre
 * la convierta en el mensaje que la pantalla ya sabe pintar.
 */
export async function sendWithRetry(
  attempt: () => Promise<Response>,
  options: { mode: RetryMode; signal?: AbortSignal; budgetMs?: number; now?: () => number },
): Promise<Response> {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? RETRY_BUDGET_MS);

  for (let n = 1; ; n++) {
    let response: Response | null = null;
    let failure: unknown = null;
    let outage: Outage | null;

    try {
      response = await attempt();
      outage = await outageOf(response);
    } catch (error) {
      failure = error;
      outage = outageOfError(error);
    }

    const delay = delayBeforeAttempt(n);
    const retry =
      deservesRetry(outage, options.mode) && !options.signal?.aborted && now() + delay <= deadline;

    if (!retry) {
      if (response) return response;
      throw failure;
    }
    await sleep(delay, options.signal);
  }
}

/**
 * El servicio —no la red ni la pasarela— dijo que esa credencial ya no sirve.
 *
 * Vive aquí, junto al resto de la clasificación, porque decide lo mismo: si el fallo es del servidor
 * o de la sesión. `AuthProvider` sólo cierra la sesión cuando esto es cierto; antes la cerraba ante
 * cualquier fallo, y un refresco que caía en un despliegue echaba del portal a quien tenía un
 * refresh token válido, con el mensaje «Tu sesión venció».
 */
export function sessionRejected(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.kind === 'unauthorized' || error.kind === 'forbidden';
}
