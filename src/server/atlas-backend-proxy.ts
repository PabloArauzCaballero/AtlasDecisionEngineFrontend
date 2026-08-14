import { NextRequest, NextResponse } from 'next/server';

/**
 * Segundo destino del portal, y el motivo por el que no basta con el que ya había.
 *
 * `/v1/*` va al motor de decisión. El cuaderno de datos no lee del motor: lee de la superficie
 * `read_api` de AtlasBackend, que es donde viven los clientes, los casos y la bitácora. Son dos
 * servicios distintos con dos bases distintas, así que son dos saltos distintos.
 *
 * Lo que SÍ comparten es la credencial: el token de la sesión lo emite AtlasBackend y el motor lo
 * reenvía tal cual al iniciar sesión, de modo que el mismo `Authorization` que abre `/v1/*` vale
 * aquí. No hay una segunda sesión que gestionar ni una clave de servicio que prestar — y no
 * haberla es lo que evita el problema del «diputado confundido» que hubo con el generador
 * documental, donde el portal ponía una credencial propia y con ella cualquiera sin sesión
 * alcanzaba el servicio de detrás.
 */

const requestHeadersToRemove = [
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
  // Procedencia declarada por el navegador: se descarta y se vuelve a poner sólo lo acreditable.
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

/** Prefijo global de AtlasBackend (`API_PREFIX=api/v1`). */
const BACKEND_API_PREFIX = 'api/v1';

function atlasBackendBaseUrl(): URL {
  // Se lee por petición, no al importar el módulo: un valor congelado en la importación obliga a
  // reiniciar el proceso para cambiar de destino y deja las pruebas atadas al entorno del arranque.
  const raw = process.env.ATLAS_BACKEND_URL ?? 'http://127.0.0.1:53005';
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('ATLAS_BACKEND_URL debe usar HTTP o HTTPS.');
  }
  return url;
}

function upstreamTimeoutMs(): number {
  const declared = Number(process.env.ATLAS_BACKEND_TIMEOUT_MS);
  return Number.isFinite(declared) && declared > 0 ? declared : 20_000;
}

function trustedClientChain(request: NextRequest): string | null {
  if (process.env.TRUSTED_PROXY !== 'true') return null;
  const chain = request.headers.get('x-forwarded-for')?.trim();
  return chain ? chain : null;
}

/** Proxy del mismo origen hacia AtlasBackend, resolviendo el destino en cada petición. */
export async function proxyAtlasBackend(
  request: NextRequest,
  pathSegments: readonly string[],
): Promise<Response> {
  try {
    const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');
    const baseUrl = atlasBackendBaseUrl();
    const target = new URL(
      `${BACKEND_API_PREFIX}/${encodedPath}`,
      `${baseUrl.toString().replace(/\/+$/, '')}/`,
    );
    target.search = request.nextUrl.search;

    const clientChain = trustedClientChain(request);
    const headers = new Headers(request.headers);
    requestHeadersToRemove.forEach((header) => headers.delete(header));
    // `fetch` descomprime el cuerpo; pedir identidad evita reenviar al navegador un
    // `content-encoding` que ya no describe lo que viaja.
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
      signal: AbortSignal.timeout(upstreamTimeoutMs()),
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeadersToRemove.forEach((header) => responseHeaders.delete(header));

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // «No contesta» y «no llegué» se arreglan en sitios distintos: 504 apunta al backend
    // sobrecargado y 502 a la red o a la configuración del destino.
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json(
      timedOut
        ? {
            code: 'ATLAS_BACKEND_TIMEOUT',
            message: 'AtlasBackend no respondió dentro del tiempo máximo.',
          }
        : {
            code: 'ATLAS_BACKEND_UNAVAILABLE',
            message: 'No fue posible conectar el portal con AtlasBackend.',
          },
      { status: timedOut ? 504 : 502 },
    );
  }
}
