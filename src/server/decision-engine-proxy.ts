import { NextRequest, NextResponse } from 'next/server';
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
 * Rutas del generador documental que tardan más en responder.
 *
 * Sólo cambian el PLAZO, no el destino: todo `/pdf/*` va al motor, que integra
 * el generador y comprueba la identidad y los roles de quien pide. El portal ya
 * no presta ninguna credencial de servicio: con ella, cualquier `Authorization`
 * —aunque fuera «x»— bastaba para imprimir con la identidad institucional.
 */
const RUTAS_QUE_IMPRIMEN: readonly string[] = ['pdf/generate', 'pdf/preview'];

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
    const [prefix, ...rest] = pathSegments;
    const target = prefix ? buildUpstreamUrl(decisionEngineBaseUrl(), prefix, rest) : null;
    if (!target) {
      return NextResponse.json(
        { code: 'INVALID_PATH', message: 'La ruta pedida no es válida.' },
        { status: 400 },
      );
    }
    const relativePath = pathSegments.join('/');
    // La comparación es por prefijo de ruta COMPLETA, no por `includes`: un
    // template llamado «generate» no debe cambiar el plazo de su consulta.
    const imprime = RUTAS_QUE_IMPRIMEN.some(
      (ruta) => relativePath === ruta || relativePath.startsWith(`${ruta}/`),
    );
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

    // Sin sesión no se llama a nadie: el motor respondería lo mismo, pero así ni se le molesta.
    if (imprime && !request.headers.get('authorization')) {
      return NextResponse.json(
        {
          code: 'UNAUTHORIZED',
          message: 'Generar un documento exige una sesión activa.',
        },
        { status: 401 },
      );
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
