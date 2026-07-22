import { NextRequest, NextResponse } from 'next/server';

const requestHeadersToRemove = ['connection', 'content-length', 'host', 'transfer-encoding'];
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

    const headers = new Headers(request.headers);
    requestHeadersToRemove.forEach((header) => headers.delete(header));
    // Native fetch decodes compressed bodies. Asking the internal hop for identity
    // avoids forwarding a stale content-encoding header to the browser.
    headers.set('accept-encoding', 'identity');
    headers.set('x-forwarded-host', request.nextUrl.host);
    headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));

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
