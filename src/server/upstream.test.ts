// @vitest-environment node
/**
 * Plazos y cancelación de los proxies contra un servidor HTTP REAL (TSK-DEF-02).
 *
 * Con `fetch` simulado no se ve el defecto: `AbortSignal.timeout` sólo corta el cuerpo cuando
 * hay un cuerpo de verdad fluyendo por un socket. Medido antes del arreglo: un SSE de 10 eventos
 * cada 300 ms con un plazo de cabeceras de 1 s llegaba cortado tras 3 eventos (TimeoutError).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { NextRequest } from 'next/server';
import { proxyAtlasBackend } from './atlas-backend-proxy';
import { proxyDecisionEngine } from './decision-engine-proxy';
import { buildUpstreamUrl, isUnsafePathSegment } from './upstream';

interface Upstream {
  readonly url: string;
  readonly closed: Promise<void>;
  readonly seen: string[];
  close(): Promise<void>;
}

/** Servidor local; `closed` se resuelve cuando se cierra la primera conexión entrante. */
function listen(handler: http.RequestListener): Promise<Upstream> {
  const seen: string[] = [];
  let markClosed: () => void = () => undefined;
  const closed = new Promise<void>((resolve) => {
    markClosed = resolve;
  });
  const server = http.createServer((req, res) => {
    seen.push(req.url ?? '');
    res.on('close', () => markClosed());
    handler(req, res);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        closed,
        seen,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      }),
    ),
  );
}

/** SSE de `count` eventos cada `everyMs`. */
function sse(count: number, everyMs: number): http.RequestListener {
  return (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      res.write(`event: tick\ndata: {"n":${n}}\n\n`);
      if (n >= count) {
        clearInterval(timer);
        res.end();
      }
    }, everyMs);
    req.on('close', () => clearInterval(timer));
  };
}

async function countEvents(body: ReadableStream<Uint8Array>): Promise<number> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return (text.match(/event: tick/g) ?? []).length;
}

const ENV = [
  'DECISION_ENGINE_URL',
  'DECISION_ENGINE_TIMEOUT_MS',
  'DECISION_ENGINE_STREAM_IDLE_TIMEOUT_MS',
  'ATLAS_BACKEND_URL',
  'ATLAS_BACKEND_TIMEOUT_MS',
  'ATLAS_BACKEND_STREAM_IDLE_TIMEOUT_MS',
] as const;

describe('proxies contra un upstream real', () => {
  const saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));
  let upstream: Upstream | undefined;

  afterEach(async () => {
    for (const name of ENV) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    await upstream?.close();
    upstream = undefined;
  });

  const get = (path: string, signal?: AbortSignal) =>
    new NextRequest(`http://portal.local${path}`, {
      headers: { authorization: 'Bearer t' },
      signal,
    });

  it('un SSE de 10 eventos cada 300 ms llega completo con un plazo de cabeceras de 1 s', async () => {
    upstream = await listen(sse(10, 300));
    process.env.DECISION_ENGINE_URL = upstream.url;
    process.env.DECISION_ENGINE_TIMEOUT_MS = '1000';

    const started = Date.now();
    const response = await proxyDecisionEngine(get('/v1/live-executions/stream'), [
      'v1',
      'live-executions',
      'stream',
    ]);
    expect(response.status).toBe(200);
    expect(await countEvents(response.body!)).toBe(10);
    expect(Date.now() - started).toBeGreaterThan(2_500);
  });

  it('lo mismo por el proxy de AtlasBackend', async () => {
    upstream = await listen(sse(10, 300));
    process.env.ATLAS_BACKEND_URL = upstream.url;
    process.env.ATLAS_BACKEND_TIMEOUT_MS = '1000';

    const response = await proxyAtlasBackend(get('/atlas-backend/events'), ['events']);
    expect(response.status).toBe(200);
    expect(await countEvents(response.body!)).toBe(10);
    expect(upstream.seen).toEqual(['/api/v1/events']);
  });

  it('un upstream que no envía cabeceras se corta al plazo con 504', async () => {
    upstream = await listen(() => {
      /* acepta la conexión y calla */
    });
    process.env.DECISION_ENGINE_URL = upstream.url;
    process.env.DECISION_ENGINE_TIMEOUT_MS = '400';

    const started = Date.now();
    const response = await proxyDecisionEngine(get('/v1/environments'), ['v1', 'environments']);
    const elapsed = Date.now() - started;

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'DECISION_ENGINE_TIMEOUT' }),
    );
    expect(elapsed).toBeGreaterThanOrEqual(350);
    expect(elapsed).toBeLessThan(3_000);
    // Y la conexión de arriba no queda colgada.
    await upstream.closed;
  });

  it('AtlasBackend sin cabeceras también se corta con 504', async () => {
    upstream = await listen(() => undefined);
    process.env.ATLAS_BACKEND_URL = upstream.url;
    process.env.ATLAS_BACKEND_TIMEOUT_MS = '400';

    const response = await proxyAtlasBackend(get('/atlas-backend/x'), ['x']);
    expect(response.status).toBe(504);
    await upstream.closed;
  });

  it('un flujo que enmudece más que el plazo de inactividad se corta', async () => {
    upstream = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('event: tick\ndata: {}\n\n');
      // …y silencio.
    });
    process.env.DECISION_ENGINE_URL = upstream.url;
    process.env.DECISION_ENGINE_TIMEOUT_MS = '1000';
    process.env.DECISION_ENGINE_STREAM_IDLE_TIMEOUT_MS = '400';

    const response = await proxyDecisionEngine(get('/v1/live-executions/stream'), [
      'v1',
      'live-executions',
      'stream',
    ]);
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('event: tick');
    await expect(reader.read()).rejects.toMatchObject({ name: 'TimeoutError' });
    await upstream.closed;
  });

  it('si el cliente aborta, se cierra la conexión con el upstream', async () => {
    upstream = await listen(sse(1_000, 100));
    process.env.DECISION_ENGINE_URL = upstream.url;

    const client = new AbortController();
    const response = await proxyDecisionEngine(get('/v1/live-executions/stream', client.signal), [
      'v1',
      'live-executions',
      'stream',
    ]);
    const reader = response.body!.getReader();
    await reader.read();

    const aborted = Date.now();
    client.abort();
    await upstream.closed;
    expect(Date.now() - aborted).toBeLessThan(2_000);
    await expect(reader.read()).rejects.toBeDefined();
  });

  it('si quien consume cancela el cuerpo, también se cierra el upstream', async () => {
    upstream = await listen(sse(1_000, 100));
    process.env.ATLAS_BACKEND_URL = upstream.url;

    const response = await proxyAtlasBackend(get('/atlas-backend/events'), ['events']);
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    await upstream.closed;
  });

  it('AtlasBackend rechaza un `..` con 400 sin llamar al upstream', async () => {
    upstream = await listen((_req, res) => res.end('{}'));
    process.env.ATLAS_BACKEND_URL = upstream.url;

    for (const segments of [
      ['..', 'internal', 'auth', 'me'],
      ['%2E%2E', 'x'],
      ['a', '..%2F..'],
    ]) {
      const response = await proxyAtlasBackend(get('/atlas-backend/x'), segments);
      expect(response.status).toBe(400);
    }
    expect(upstream.seen).toEqual([]);
  });
});

describe('validación de segmentos', () => {
  it.each(['', '.', '..', '%2e', '%2E%2E', '.%2e', '%252E%252E', 'a/b', 'a%2Fb', 'a\\b', 'a%5Cb'])(
    '%j es inseguro',
    (segment) => expect(isUnsafePathSegment(segment)).toBe(true),
  );

  it.each(['v1', 'file.pdf', '...', 'a..b', '100%', 'n%C3%BA'])('%j es legítimo', (segment) =>
    expect(isUnsafePathSegment(segment)).toBe(false),
  );

  it('el defecto de base: sin validar, `..` sale del prefijo', () => {
    const escaped = new URL('api/v1/../../internal/auth/me', 'http://backend:3005/');
    expect(escaped.pathname).toBe('/internal/auth/me');
    expect(
      buildUpstreamUrl(new URL('http://backend:3005'), 'api/v1', ['..', '..', 'internal']),
    ).toBeNull();
  });

  it('respeta la ruta base del destino', () => {
    expect(
      String(buildUpstreamUrl(new URL('http://engine:3000/motor/'), 'v1', ['artifacts', 'a b'])),
    ).toBe('http://engine:3000/motor/v1/artifacts/a%20b');
  });
});
