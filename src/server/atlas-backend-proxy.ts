import { NextRequest, NextResponse } from 'next/server';
import { atlasBackendAccess } from './atlas-backend-allowlist';
import { buildUpstreamUrl, envMs, fetchUpstream } from './upstream';

/**
 * Segundo destino del portal, y el motivo por el que no basta con el que ya había.
 *
 * No es un comodín: sólo reenvía los prefijos de `atlas-backend-allowlist.ts`.
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

/** Plazo hasta las CABECERAS; el cuerpo lo gobierna el plazo de inactividad. */
function upstreamTimeoutMs(): number {
  return envMs('ATLAS_BACKEND_TIMEOUT_MS', 20_000);
}

/** Silencio máximo entre dos fragmentos del cuerpo (flujos incluidos). */
function idleTimeoutMs(): number {
  return envMs('ATLAS_BACKEND_STREAM_IDLE_TIMEOUT_MS', 60_000);
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
    // `..` o `%2E%2E` en un segmento sacarían la petición de `api/v1` (p. ej. hacia rutas
    // internas del backend): se rechaza antes de construir la URL.
    const target = buildUpstreamUrl(atlasBackendBaseUrl(), BACKEND_API_PREFIX, pathSegments);
    if (!target) {
      return NextResponse.json(
        { code: 'INVALID_PATH', message: 'La ruta pedida no es válida.' },
        { status: 400 },
      );
    }
    target.search = request.nextUrl.search;

    // Sólo lo que el portal usa de verdad (ver `atlas-backend-allowlist.ts`). Va DESPUÉS de
    // validar los segmentos: un `..` sigue siendo un 400, no un 404 que lo disimule.
    const access = atlasBackendAccess(request.method, pathSegments);
    if (access === 'not-found') {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Ruta no disponible desde el portal.' },
        { status: 404 },
      );
    }
    if (access === 'method-not-allowed') {
      return NextResponse.json(
        { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido en esta ruta.' },
        { status: 405 },
      );
    }

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

    const { response: upstream, body: upstreamBody } = await fetchUpstream(
      target,
      {
        method: request.method,
        headers,
        body: body?.byteLength ? body : undefined,
        redirect: 'manual',
        cache: 'no-store',
      },
      { headersTimeoutMs: upstreamTimeoutMs(), idleTimeoutMs: idleTimeoutMs() },
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
