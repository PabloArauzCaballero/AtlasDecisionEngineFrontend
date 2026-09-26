import { NextRequest, NextResponse } from 'next/server';
import { verifyPrintingAuthorization } from './print-authorization';
import { buildUpstreamUrl, envMs, fetchUpstream } from './upstream';

const requestHeadersToRemove = [
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
  /*
   * Cabeceras de procedencia: el navegador puede escribir cualquiera de estas y
   * el motor las cree. Si se reenvían tal cual, cualquiera puede declarar la IP
   * que quiera y contaminar el rastro de auditoría, las listas por IP y los
   * límites de frecuencia del backend. El proxy las descarta y vuelve a
   * declarar sólo las que él mismo puede acreditar.
   */
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
  'x-real-ip',
  'true-client-ip',
  'cf-connecting-ip',
];
const responseHeadersToRemove = [
  'connection',
  'content-encoding',
  'content-length',
  'transfer-encoding',
];

/**
 * Techo de espera del salto portal→motor HASTA LAS CABECERAS.
 *
 * El navegador ya se rinde a los 15 s (`NEXT_PUBLIC_API_TIMEOUT_MS`), pero este
 * salto no tenía ninguno: un motor que aceptaba la conexión y no respondía
 * dejaba la petición viva en el servidor de Next indefinidamente. Se corta un
 * poco por encima del cliente para que, cuando los dos plazos apliquen, el
 * mensaje que llegue sea el del navegador, que es el más concreto.
 *
 * Se lee por petición y no al cargar el módulo, igual que `DECISION_ENGINE_URL`.
 */
function upstreamTimeoutMs(): number {
  return envMs('DECISION_ENGINE_TIMEOUT_MS', 20_000);
}

/**
 * Plazo de cabeceras para las rutas que imprimen.
 *
 * Imprimir arranca un navegador, compone el documento y lo pagina, y el PRIMER
 * render es el más lento porque incluye el arranque de Chromium. Se deja por
 * encima de `PDF_RENDER_TIMEOUT_MS` del generador (30 s de serie) para que quien
 * corte sea él —con su error explicado— y no este proxy.
 */
function printingTimeoutMs(): number {
  return envMs('PDF_PROXY_TIMEOUT_MS', 60_000);
}

/**
 * Silencio máximo del cuerpo una vez recibidas las cabeceras. Holgadamente por
 * encima del latido de 15 s de los flujos de eventos del motor: un flujo que late
 * no se corta nunca; uno mudo, sí.
 */
function idleTimeoutMs(): number {
  return envMs('DECISION_ENGINE_STREAM_IDLE_TIMEOUT_MS', 60_000);
}

/**
 * Rutas del generador documental que EXIGEN un navegador.
 *
 * La imagen de la API del motor no lleva Chromium, así que imprimir contra ella
 * falla; quien puede es el servicio `pdf-worker` (`PDF_WORKER_URL`). El resto de
 * `/pdf/*` va siempre al motor, que tiene la base.
 *
 * El worker sólo comprueba la clave de SERVICIO, así que antes de prestarla el
 * portal pide al motor que valide la sesión y el rol de quien imprime
 * (`verifyPrintingAuthorization`). Sin `PDF_WORKER_URL`, estas rutas van al motor
 * con el bearer del usuario y SIN la clave: el motor autentica por sí mismo y la
 * clave no tiene nada que hacer allí (FND-DEF-01).
 */
const RUTAS_QUE_IMPRIMEN: readonly string[] = ['pdf/generate', 'pdf/preview'];

function pdfWorkerBaseUrl(): URL | undefined {
  const raw = process.env.PDF_WORKER_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('PDF_WORKER_URL debe usar HTTP o HTTPS.');
  }
  return url;
}

function pdfServiceKey(): string | undefined {
  const raw = process.env.PDF_WORKER_SERVICE_KEY?.trim();
  return raw ? raw : undefined;
}

function decisionEngineBaseUrl(): URL {
  const raw = process.env.DECISION_ENGINE_URL ?? 'http://localhost:3000';
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('DECISION_ENGINE_URL debe usar HTTP o HTTPS.');
  }
  return url;
}

/**
 * Cadena de IPs del cliente, sólo cuando es creíble.
 *
 * Detrás de un ingress de confianza (`TRUSTED_PROXY=true`) el primer salto ya
 * escribió `x-forwarded-for` y merece llegar al motor. Expuesto directamente a
 * Internet, esa misma cabecera la elige quien llama, así que se descarta: es
 * preferible que el backend no sepa la IP a que registre una inventada.
 */
function trustedClientChain(request: NextRequest): string | null {
  if (process.env.TRUSTED_PROXY !== 'true') return null;
  const chain = request.headers.get('x-forwarded-for')?.trim();
  return chain ? chain : null;
}

/** Same-origin server proxy whose destination is resolved at request time. */
export async function proxyDecisionEngine(
  request: NextRequest,
  pathSegments: readonly string[],
): Promise<Response> {
  try {
    const relativePath = pathSegments.join('/');
    // La comparación es por prefijo de ruta COMPLETA, no por `includes`: un
    // template llamado «generate» no debe desviar su consulta de catálogo.
    const imprime = RUTAS_QUE_IMPRIMEN.some(
      (ruta) => relativePath === ruta || relativePath.startsWith(`${ruta}/`),
    );
    const engineBaseUrl = decisionEngineBaseUrl();
    const workerBaseUrl = imprime ? pdfWorkerBaseUrl() : undefined;
    const [prefix, ...rest] = pathSegments;
    const target = prefix ? buildUpstreamUrl(workerBaseUrl ?? engineBaseUrl, prefix, rest) : null;
    if (!target) {
      return NextResponse.json(
        { code: 'INVALID_PATH', message: 'La ruta pedida no es válida.' },
        { status: 400 },
      );
    }
    target.search = request.nextUrl.search;

    // La procedencia del cliente sólo se conserva si el despliegue declara que
    // hay un proxy de confianza delante (`TRUSTED_PROXY=true`). Sin esa promesa
    // la cabecera la escribe el propio navegador y vale menos que nada.
    const clientChain = trustedClientChain(request);

    const headers = new Headers(request.headers);
    requestHeadersToRemove.forEach((header) => headers.delete(header));
    // Native fetch decodes compressed bodies. Asking the internal hop for identity
    // avoids forwarding a stale content-encoding header to the browser.
    headers.set('accept-encoding', 'identity');
    headers.set('x-forwarded-host', request.nextUrl.host);
    headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
    if (clientChain) headers.set('x-forwarded-for', clientChain);

    if (imprime) {
      // Sin sesión no se llama a nadie: ni al motor ni, sobre todo, al worker.
      const authorization = request.headers.get('authorization');
      if (!authorization) {
        return NextResponse.json(
          {
            code: 'UNAUTHORIZED',
            message: 'Generar un documento exige una sesión activa.',
          },
          { status: 401 },
        );
      }
      if (workerBaseUrl) {
        // La clave del worker sólo se presta cuando el MOTOR ha aceptado esta sesión con la
        // política de impresión. Si dice que no —o no contesta— el worker no se toca.
        const denied = await verifyPrintingAuthorization(
          engineBaseUrl,
          request,
          authorization,
          headers,
        );
        if (denied) return denied;
        const serviceKey = pdfServiceKey();
        if (serviceKey) headers.set('x-pdf-service-key', serviceKey);
      }
    }

    const canHaveBody = request.method !== 'GET' && request.method !== 'HEAD';
    const body = canHaveBody ? await request.arrayBuffer() : undefined;
    const { response: upstream, body: upstreamBody } = await fetchUpstream(
      target,
      {
        method: request.method,
        headers,
        body: body?.byteLength ? body : undefined,
        redirect: 'manual',
        cache: 'no-store',
      },
      {
        headersTimeoutMs: imprime ? printingTimeoutMs() : upstreamTimeoutMs(),
        idleTimeoutMs: idleTimeoutMs(),
      },
      request.signal,
    );

    /*
     * Un 401/403 del WORKER no es un 401 de quien mira la pantalla: la sesión ya la aceptó el
     * motor, así que es el portal el que no se acredita ante el worker (clave ausente o
     * distinta). Reenviarlo haría que `authorizedFetch` cerrara la sesión de la persona.
     */
    if (workerBaseUrl && (upstream.status === 401 || upstream.status === 403)) {
      await upstreamBody?.cancel().catch(() => undefined);
      return NextResponse.json(
        {
          code: 'PDF_WORKER_UNAUTHORIZED',
          message:
            'El portal no pudo acreditarse ante el generador documental. Es un problema de ' +
            'configuración del servidor (PDF_WORKER_SERVICE_KEY), no de tu sesión.',
        },
        { status: 502 },
      );
    }

    const responseHeaders = new Headers(upstream.headers);
    responseHeadersToRemove.forEach((header) => responseHeaders.delete(header));

    return new Response(upstreamBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // «No contesta» y «no llegué» se arreglan en sitios distintos: un 504 apunta
    // al motor sobrecargado y un 502 a la red o a la configuración del destino.
    // Con un único 502 para las dos, el registro no distinguía cuál era.
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json(
      timedOut
        ? {
            code: 'DECISION_ENGINE_TIMEOUT',
            message: 'El Decision Engine no respondió dentro del tiempo máximo.',
          }
        : {
            code: 'DECISION_ENGINE_UNAVAILABLE',
            message: 'No fue posible conectar el portal con el Decision Engine.',
          },
      { status: timedOut ? 504 : 502 },
    );
  }
}
