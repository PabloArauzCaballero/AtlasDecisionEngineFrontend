/**
 * Piezas comunes de los dos proxies del portal (motor y AtlasBackend).
 *
 * Viven aparte porque son justo las dos cosas que no pueden divergir entre un proxy y otro: qué
 * segmentos de ruta se aceptan y cómo se reparten los plazos. Un proxy nuevo que las reescriba a
 * mano vuelve a abrir los dos defectos que este módulo cierra.
 */

/**
 * Un segmento de ruta que el proxy NO debe reenviar.
 *
 * `encodeURIComponent('..')` es `'..'`, y `new URL('v1/../../internal/x', base)` lo resuelve:
 * la petición sale del prefijo que la ruta de Next abrió (`/v1`, `/pdf`, `api/v1`) hacia
 * cualquier otra ruta del servicio de detrás. Se rechazan los segmentos vacíos, `.` y `..` y
 * las barras, también cuando llegan codificadas una o varias veces (`%2E%2E`, `%252e`, `%2F`),
 * porque cada salto intermedio puede decodificar una capa más.
 */
export function isUnsafePathSegment(segment: string): boolean {
  let current = segment;
  // Unas pocas capas bastan: cada una es un salto que decodifica; más allá no hay quien lo haga.
  for (let layer = 0; layer < 4; layer += 1) {
    if (current === '' || current === '.' || current === '..') return true;
    if (current.includes('/') || current.includes('\\')) return true;
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      // Un `%` suelto no es un escape: `encodeURIComponent` lo reenvía como `%25`.
      return false;
    }
    if (decoded === current) return false;
    current = decoded;
  }
  return true;
}

/**
 * Construye la URL de destino y comprueba que no se sale del prefijo esperado.
 *
 * Devuelve `null` si algún segmento es inseguro o si el pathname final no empieza por
 * `<base>/<prefijo>`. La segunda comprobación es la red: aunque un segmento raro pasara el
 * filtro, la petición no sale del prefijo.
 */
export function buildUpstreamUrl(
  baseUrl: URL,
  prefix: string,
  pathSegments: readonly string[],
): URL | null {
  if (pathSegments.some(isUnsafePathSegment)) return null;
  const base = `${baseUrl.toString().replace(/\/+$/, '')}/`;
  const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');
  const relative = encodedPath ? `${prefix}/${encodedPath}` : prefix;
  const target = new URL(relative, base);
  const expected = new URL(prefix, base).pathname;
  const within =
    target.origin === new URL(base).origin &&
    (target.pathname === expected || target.pathname.startsWith(`${expected}/`));
  return within ? target : null;
}

export interface UpstreamBudget {
  /** Plazo hasta recibir las CABECERAS de la respuesta. */
  readonly headersTimeoutMs: number;
  /** Silencio máximo entre dos fragmentos del cuerpo una vez recibidas las cabeceras. */
  readonly idleTimeoutMs: number;
}

export class UpstreamTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export interface UpstreamResult {
  readonly response: Response;
  /** Cuerpo envuelto: aplica el plazo de inactividad y libera la conexión al cancelar. */
  readonly body: ReadableStream<Uint8Array> | null;
}

/**
 * `fetch` con un `AbortController` propio y los plazos repartidos.
 *
 * `AbortSignal.timeout` NO sirve aquí: sigue vivo después de las cabeceras y corta también el
 * cuerpo, así que un flujo de eventos (`text/event-stream`) moría al vencer el plazo pensado
 * para la cabecera (medido: 3 de 10 eventos con un plazo de 1 s). Aquí:
 *
 *  - el plazo de cabeceras es un `setTimeout` que se limpia en cuanto llega la respuesta;
 *  - después, cada fragmento del cuerpo rearma un plazo de INACTIVIDAD, mayor que el latido
 *    del motor (15 s), de modo que un flujo que emite sigue abierto indefinidamente y uno
 *    mudo se corta;
 *  - si el cliente se va (`clientSignal`), se aborta el salto hacia arriba y el servicio de
 *    detrás deja de trabajar para nadie;
 *  - si quien consume el cuerpo lo cancela (Next lo hace al cerrarse la conexión), también.
 *
 * Los errores antes de las cabeceras se relanzan; `UpstreamTimeoutError` distingue el plazo.
 */
export async function fetchUpstream(
  target: URL,
  init: Omit<RequestInit, 'signal'>,
  budget: UpstreamBudget,
  clientSignal?: AbortSignal | null,
): Promise<UpstreamResult> {
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const onClientAbort = () => controller.abort(clientSignal?.reason);
  const release = () => {
    clearTimeout(idleTimer);
    clientSignal?.removeEventListener('abort', onClientAbort);
  };
  if (clientSignal?.aborted) controller.abort(clientSignal.reason);
  else clientSignal?.addEventListener('abort', onClientAbort, { once: true });

  const headersTimer = setTimeout(
    () =>
      controller.abort(
        new UpstreamTimeoutError('El servicio no envió cabeceras dentro del plazo.'),
      ),
    budget.headersTimeoutMs,
  );

  let response: Response;
  try {
    response = await fetch(target, { ...init, signal: controller.signal });
  } catch (error) {
    release();
    if (controller.signal.reason instanceof UpstreamTimeoutError) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(headersTimer);
  }

  const upstreamBody = response.body;
  if (!upstreamBody) {
    release();
    return { response, body: null };
  }

  const reader = upstreamBody.getReader();

  let failIdle: () => void = () => undefined;
  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(failIdle, budget.idleTimeoutMs);
  };

  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      failIdle = () => {
        const reason = new UpstreamTimeoutError('El servicio dejó de emitir dentro del plazo.');
        release();
        controller.abort(reason);
        try {
          streamController.error(reason);
        } catch {
          /* ya cerrado */
        }
      };
    },
    async pull(streamController) {
      // El plazo sólo corre mientras se ESPERA al servicio: un cliente lento que tarda en
      // pedir el siguiente fragmento no cuenta como silencio del servicio.
      armIdle();
      try {
        const { value, done } = await reader.read();
        clearTimeout(idleTimer);
        if (done) {
          release();
          streamController.close();
          return;
        }
        streamController.enqueue(value);
      } catch (error) {
        release();
        // Si el plazo ya cerró el flujo con su propio error, no hay nada más que avisar.
        try {
          streamController.error(error);
        } catch {
          /* ya cerrado */
        }
      }
    },
    async cancel(reason) {
      release();
      controller.abort(reason);
      await reader.cancel(reason).catch(() => undefined);
    },
  });

  return { response, body };
}

/** Lee un plazo en milisegundos del entorno, por petición, con un valor por omisión. */
export function envMs(name: string, fallback: number): number {
  const declared = Number(process.env[name]);
  return Number.isFinite(declared) && declared > 0 ? declared : fallback;
}
