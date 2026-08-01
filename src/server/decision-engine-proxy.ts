import { NextRequest, NextResponse } from 'next/server';

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
    const baseUrl = decisionEngineBaseUrl();
    const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');
    const target = new URL(encodedPath, `${baseUrl.toString().replace(/\/+$/, '')}/`);
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

    const canHaveBody = request.method !== 'GET' && request.method !== 'HEAD';
    const body = canHaveBody ? await request.arrayBuffer() : undefined;
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body?.byteLength ? body : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeadersToRemove.forEach((header) => responseHeaders.delete(header));

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        code: 'DECISION_ENGINE_UNAVAILABLE',
        message: 'No fue posible conectar el portal con el Decision Engine.',
      },
      { status: 502 },
    );
  }
}
