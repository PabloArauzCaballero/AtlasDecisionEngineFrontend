import type { NextRequest } from 'next/server';
import { proxyDecisionEngine } from './decision-engine-proxy';

function request(url: string, extraHeaders: Record<string, string> = {}): NextRequest {
  return {
    method: 'GET',
    headers: new Headers({ authorization: 'Bearer portal-token', ...extraHeaders }),
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

/** Cabeceras con las que un navegador intentaría inventarse su procedencia. */
const SPOOFED = {
  'x-forwarded-for': '10.0.0.9',
  'x-real-ip': '10.0.0.9',
  forwarded: 'for=10.0.0.9',
  'true-client-ip': '10.0.0.9',
  'cf-connecting-ip': '10.0.0.9',
  'x-forwarded-host': 'evil.example',
  'x-forwarded-proto': 'https',
};

describe('decision engine proxy', () => {
  const previousUrl = process.env.DECISION_ENGINE_URL;
  const previousTrust = process.env.TRUSTED_PROXY;
  const previousTimeoutMs = process.env.DECISION_ENGINE_TIMEOUT_MS;

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.DECISION_ENGINE_URL;
    else process.env.DECISION_ENGINE_URL = previousUrl;
    if (previousTrust === undefined) delete process.env.TRUSTED_PROXY;
    else process.env.TRUSTED_PROXY = previousTrust;
    if (previousTimeoutMs === undefined) delete process.env.DECISION_ENGINE_TIMEOUT_MS;
    else process.env.DECISION_ENGINE_TIMEOUT_MS = previousTimeoutMs;
    delete process.env.PDF_WORKER_URL;
    delete process.env.PDF_WORKER_SERVICE_KEY;
  });

  it('resolves DECISION_ENGINE_URL at request time and preserves query parameters', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );

    process.env.DECISION_ENGINE_URL = 'http://engine-a:3000';
    await proxyDecisionEngine(request('https://portal.example/v1/environments?page=2'), [
      'v1',
      'environments',
    ]);
    process.env.DECISION_ENGINE_URL = 'http://engine-b:3000';
    await proxyDecisionEngine(request('https://portal.example/health/ready'), ['health', 'ready']);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://engine-a:3000/v1/environments?page=2',
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('http://engine-b:3000/health/ready');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: 'GET', redirect: 'manual', cache: 'no-store' }),
    );
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('accept-encoding')).toBe(
      'identity',
    );
  });

  it('drops the client-supplied provenance headers so the engine cannot be lied to', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    delete process.env.TRUSTED_PROXY;

    await proxyDecisionEngine(request('https://portal.example/v1/executions', SPOOFED), [
      'v1',
      'executions',
    ]);

    const sent = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    // Nada de lo que declaró el navegador sobre su origen sobrevive…
    expect(sent.get('x-forwarded-for')).toBeNull();
    expect(sent.get('x-real-ip')).toBeNull();
    expect(sent.get('forwarded')).toBeNull();
    expect(sent.get('true-client-ip')).toBeNull();
    expect(sent.get('cf-connecting-ip')).toBeNull();
    // …y el host/protocolo los vuelve a declarar el proxy con lo que sí sabe.
    expect(sent.get('x-forwarded-host')).toBe('portal.example');
    expect(sent.get('x-forwarded-proto')).toBe('https');
    // La autorización real del portal sigue pasando.
    expect(sent.get('authorization')).toBe('Bearer portal-token');
  });

  it('preserves the client chain only when the deployment declares a trusted proxy', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    process.env.TRUSTED_PROXY = 'true';

    await proxyDecisionEngine(
      request('https://portal.example/v1/executions', { 'x-forwarded-for': '203.0.113.7' }),
      ['v1', 'executions'],
    );

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('x-forwarded-for')).toBe(
      '203.0.113.7',
    );
  });

  it('rejects non-HTTP destinations without issuing an upstream request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    process.env.DECISION_ENGINE_URL = 'file:///etc/passwd';

    const response = await proxyDecisionEngine(request('https://portal.example/health'), [
      'health',
    ]);

    expect(response.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('corta el salto al motor cuando no responde, y lo distingue de no llegar', async () => {
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    // El plazo se resuelve por petición, así que la prueba puede acortarlo en vez
    // de esperar veinte segundos de reloj para comprobar una rama.
    process.env.DECISION_ENGINE_TIMEOUT_MS = '50';

    // Un motor que acepta la conexión y se queda callado: sin plazo, esta
    // petición retenía un hueco del servidor de Next para siempre.
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      const signal = (init as RequestInit | undefined)?.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted due to timeout');
          error.name = 'TimeoutError';
          reject(error);
        });
      });
    });

    const response = await proxyDecisionEngine(request('https://portal.example/v1/environments'), [
      'v1',
      'environments',
    ]);

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'DECISION_ENGINE_TIMEOUT' }),
    );
  });

  it('sigue devolviendo 502 cuando el problema es llegar, no esperar', async () => {
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    const response = await proxyDecisionEngine(request('https://portal.example/v1/environments'), [
      'v1',
      'environments',
    ]);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'DECISION_ENGINE_UNAVAILABLE' }),
    );
  });

  it('un 401 del MOTOR sí se reenvía: ahí la sesión sí es lo que falla', async () => {
    // Si el motor rechaza el token, la sesión de verdad venció y el portal debe enterarse.
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

    const response = await proxyDecisionEngine(request('https://portal.example/v1/artifacts'), [
      'v1',
      'artifacts',
    ]);

    expect(response.status).toBe(401);
  });

  /*
   * ATL-01 / FND-DEF-01. El portal desviaba `pdf/generate` y `pdf/preview` al worker suelto y le
   * prestaba su clave de SERVICIO a cualquiera que trajera una cabecera `Authorization`, fuera la
   * que fuera («x» bastaba: el worker sólo miraba la clave). Y sin `PDF_WORKER_URL` la clave viajaba
   * igualmente al motor. Ahora todo `/pdf/*` va al motor con el bearer del usuario, que es quien
   * comprueba identidad y roles, y la clave no existe en el portal.
   */
  describe('impresión: todo /pdf/* va al motor con la credencial del usuario', () => {
    const printing = (path: string, authorization: string) =>
      ({
        method: 'POST',
        headers: new Headers({ authorization, 'content-type': 'application/json' }),
        nextUrl: new URL(`https://portal.example/${path}`),
        arrayBuffer: async () => new TextEncoder().encode('{"templateId":"x"}').buffer,
      }) as unknown as NextRequest;

    for (const workerUrl of ['http://pdf-worker:3100', undefined]) {
      for (const ruta of ['generate', 'preview']) {
        it(`pdf/${ruta} con Authorization arbitrario ${
          workerUrl ? 'y PDF_WORKER_URL definida' : 'sin PDF_WORKER_URL'
        }: al motor y sin clave de servicio`, async () => {
          process.env.DECISION_ENGINE_URL = 'http://engine:3000';
          if (workerUrl) process.env.PDF_WORKER_URL = workerUrl;
          process.env.PDF_WORKER_SERVICE_KEY = 'clave-de-servicio';
          const upstream = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response('{"code":"UNAUTHORIZED"}', { status: 401 }));

          const response = await proxyDecisionEngine(printing(`pdf/${ruta}`, 'x'), ['pdf', ruta]);

          expect(upstream).toHaveBeenCalledTimes(1);
          expect(String(upstream.mock.calls[0]?.[0])).toBe(`http://engine:3000/pdf/${ruta}`);
          const sent = new Headers((upstream.mock.calls[0]?.[1] as RequestInit).headers);
          expect(sent.get('x-pdf-service-key')).toBeNull();
          expect(sent.get('authorization')).toBe('x');
          // El 401 es del motor —la sesión no vale— y se reenvía tal cual.
          expect(response.status).toBe(401);
        });
      }
    }

    it('sin Authorization responde 401 y no llama a nadie', async () => {
      process.env.DECISION_ENGINE_URL = 'http://engine:3000';
      const upstream = vi.spyOn(globalThis, 'fetch');

      const anonima = {
        method: 'POST',
        headers: new Headers(),
        nextUrl: new URL('https://portal.example/pdf/generate'),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as NextRequest;

      const response = await proxyDecisionEngine(anonima, ['pdf', 'generate']);

      expect(response.status).toBe(401);
      expect(upstream).not.toHaveBeenCalled();
    });
  });

  /* TSK-DEF-03: un segmento `..` resolvía fuera del prefijo abierto por la ruta de Next. */
  describe('segmentos que escaparían del prefijo', () => {
    const escapes: readonly (readonly string[])[] = [
      ['v1', '..', 'internal', 'auth', 'me'],
      ['v1', '.', 'environments'],
      ['v1', '', 'environments'],
      ['v1', '%2E%2E', 'internal'],
      ['v1', '%2e.', 'internal'],
      ['v1', '%252E%252E', 'internal'],
      ['v1', '..%2F..%2Finternal'],
      ['v1', 'a/b'],
      ['v1', 'a%2fb'],
      ['pdf', '..', 'metrics'],
    ];

    for (const segments of escapes) {
      it(`rechaza ${JSON.stringify(segments)} con 400 sin llamar al motor`, async () => {
        process.env.DECISION_ENGINE_URL = 'http://engine:3000';
        const upstream = vi.spyOn(globalThis, 'fetch');

        const response = await proxyDecisionEngine(
          request('https://portal.example/v1/x'),
          segments,
        );

        expect(response.status).toBe(400);
        expect(upstream).not.toHaveBeenCalled();
      });
    }

    it('deja pasar segmentos legítimos con puntos', async () => {
      process.env.DECISION_ENGINE_URL = 'http://engine:3000/base';
      const upstream = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{}', { status: 200 }));

      await proxyDecisionEngine(request('https://portal.example/v1/x'), [
        'v1',
        'artifacts',
        'score.v2.json',
        '...',
      ]);

      expect(String(upstream.mock.calls[0]?.[0])).toBe(
        'http://engine:3000/base/v1/artifacts/score.v2.json/...',
      );
    });
  });
});
