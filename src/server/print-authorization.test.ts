// @vitest-environment node
/**
 * ATL-01 contra servidores HTTP REALES: un motor que aplica la política de impresión en
 * `GET /pdf/templates` y un worker que cuenta cuántas veces se le llama y con qué clave.
 *
 * Antes del arreglo, con `PDF_WORKER_URL` definida, `Authorization: x` bastaba para que el
 * worker recibiera la petición con la clave de servicio (medido en e3-def-proxy T2/T2b).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { NextRequest } from 'next/server';
import { proxyDecisionEngine } from './decision-engine-proxy';

interface Server {
  readonly url: string;
  readonly calls: { url: string; headers: http.IncomingHttpHeaders }[];
  close(): Promise<void>;
}

function listen(handler: http.RequestListener): Promise<Server> {
  const calls: Server['calls'] = [];
  const server = http.createServer((req, res) => {
    calls.push({ url: req.url ?? '', headers: req.headers });
    handler(req, res);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        calls,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      }),
    ),
  );
}

const KEY = 'k'.repeat(40);
const ENV = [
  'DECISION_ENGINE_URL',
  'PDF_WORKER_URL',
  'PDF_WORKER_SERVICE_KEY',
  'PDF_AUTHORIZATION_TIMEOUT_MS',
] as const;

/** Motor de prueba: la misma decisión que sus guardias para `@Roles(...)` de impresión. */
function engineHandler(status500 = false): http.RequestListener {
  return (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (status500) {
      res.statusCode = 500;
      res.end('{}');
      return;
    }
    const auth = req.headers.authorization;
    if (auth === 'Bearer con-rol') res.end('{"templates":[]}');
    else if (auth === 'Bearer sin-rol') {
      res.statusCode = 403;
      res.end('{"code":"FORBIDDEN"}');
    } else {
      res.statusCode = 401;
      res.end('{"code":"UNAUTHORIZED"}');
    }
  };
}

describe('impresión por el worker: el motor autoriza antes de prestar la clave', () => {
  const saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));
  const servers: Server[] = [];
  let worker: Server;

  beforeEach(async () => {
    worker = await listen((_req, res) => {
      res.setHeader('content-type', 'application/pdf');
      res.end('%PDF-1.7');
    });
    servers.push(worker);
    process.env.PDF_WORKER_URL = worker.url;
    process.env.PDF_WORKER_SERVICE_KEY = KEY;
  });

  afterEach(async () => {
    for (const name of ENV) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  const print = (ruta: string, authorization: string) =>
    proxyDecisionEngine(
      new NextRequest(`http://portal.local/pdf/${ruta}`, {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: '{"templateId":"generic-result-report","payload":{}}',
      }),
      ['pdf', ruta],
    );

  async function withEngine(handler: http.RequestListener): Promise<Server> {
    const engine = await listen(handler);
    servers.push(engine);
    process.env.DECISION_ENGINE_URL = engine.url;
    return engine;
  }

  for (const ruta of ['generate', 'preview']) {
    it(`pdf/${ruta}: Authorization arbitrario → 401 y el worker no se llama`, async () => {
      const engine = await withEngine(engineHandler());

      const response = await print(ruta, 'x');

      expect(response.status).toBe(401);
      expect(engine.calls.map((call) => call.url)).toEqual(['/pdf/templates']);
      expect(engine.calls[0]?.headers.authorization).toBe('x');
      expect(engine.calls[0]?.headers['x-pdf-service-key']).toBeUndefined();
      expect(worker.calls).toHaveLength(0);
    });
  }

  it('token válido sin rol → 403 y el worker no se llama', async () => {
    await withEngine(engineHandler());

    const response = await print('generate', 'Bearer sin-rol');

    expect(response.status).toBe(403);
    expect(worker.calls).toHaveLength(0);
  });

  it('token válido con rol → el worker recibe la clave y el bearer', async () => {
    const engine = await withEngine(engineHandler());

    const response = await print('generate', 'Bearer con-rol');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('%PDF-1.7');
    expect(worker.calls).toHaveLength(1);
    expect(worker.calls[0]?.url).toBe('/pdf/generate');
    expect(worker.calls[0]?.headers['x-pdf-service-key']).toBe(KEY);
    expect(worker.calls[0]?.headers.authorization).toBe('Bearer con-rol');
    // La clave nunca viaja al motor.
    expect(engine.calls.every((call) => call.headers['x-pdf-service-key'] === undefined)).toBe(
      true,
    );
  });

  it('motor caído → 503 y el worker no se llama', async () => {
    const engine = await withEngine(engineHandler());
    await engine.close();

    const response = await print('generate', 'Bearer con-rol');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'PDF_AUTHORIZATION_UNAVAILABLE' }),
    );
    expect(worker.calls).toHaveLength(0);
  });

  it('motor con 500 → 503 y el worker no se llama', async () => {
    await withEngine(engineHandler(true));

    const response = await print('preview', 'Bearer con-rol');

    expect(response.status).toBe(503);
    expect(worker.calls).toHaveLength(0);
  });

  it('motor que no contesta → 503 al plazo y el worker no se llama', async () => {
    await withEngine(() => undefined);
    process.env.PDF_AUTHORIZATION_TIMEOUT_MS = '300';

    const response = await print('generate', 'Bearer con-rol');

    expect(response.status).toBe(503);
    expect(worker.calls).toHaveLength(0);
  });

  it('un 401 del WORKER tras autorizar se traduce a 502 y no cierra la sesión', async () => {
    await withEngine(engineHandler());
    process.env.PDF_WORKER_SERVICE_KEY = 'otra';
    const strict = await listen((req, res) => {
      res.statusCode = req.headers['x-pdf-service-key'] === KEY ? 200 : 401;
      res.end('{}');
    });
    servers.push(strict);
    process.env.PDF_WORKER_URL = strict.url;

    const response = await print('generate', 'Bearer con-rol');

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'PDF_WORKER_UNAUTHORIZED' }),
    );
  });
});
