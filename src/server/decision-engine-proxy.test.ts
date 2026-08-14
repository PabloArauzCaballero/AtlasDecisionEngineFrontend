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

  /*
   * El defecto que estas tres pruebas impiden que vuelva.
   *
   * El generador documental dejó de aceptar peticiones anónimas y el portal siguió
   * reenviando su 401 tal cual. `authorizedFetch` lee CUALQUIER 401 como «la sesión murió»:
   * renovaba el token, reintentaba, recibía el mismo 401 y llamaba a `expireSession()`. Pulsar
   * «generar» echaba a la persona del portal con el mensaje «Tu sesión venció» — que manda a
   * revisar las credenciales de acceso cuando lo que falta es una variable del servidor.
   */
  it('un 401 del worker de PDF NO se reenvía como 401: sería echar a quien mira', async () => {
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    process.env.PDF_WORKER_URL = 'http://pdf-worker:3100';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"code":"SERVICE_UNAUTHORIZED"}', { status: 401 }),
    );

    const response = await proxyDecisionEngine(request('https://portal.example/pdf/generate'), [
      'pdf',
      'generate',
    ]);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'PDF_WORKER_UNAUTHORIZED' }),
    );
  });

  it('lo mismo con un 403 del worker', async () => {
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    process.env.PDF_WORKER_URL = 'http://pdf-worker:3100';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }));

    const response = await proxyDecisionEngine(request('https://portal.example/pdf/preview'), [
      'pdf',
      'preview',
    ]);

    expect(response.status).toBe(502);
  });

  it('un 401 del MOTOR sí se reenvía: ahí la sesión sí es lo que falla', async () => {
    /*
     * La otra mitad, y la que impide arreglar esto de más. Si el motor rechaza el token, la
     * sesión de verdad venció y el portal debe enterarse: convertir también ese 401 en 502
     * dejaría a alguien con una sesión muerta mirando «no se pudo conectar» para siempre.
     */
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    process.env.PDF_WORKER_URL = 'http://pdf-worker:3100';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

    const response = await proxyDecisionEngine(request('https://portal.example/v1/artifacts'), [
      'v1',
      'artifacts',
    ]);

    expect(response.status).toBe(401);
  });

  /*
   * El «diputado confundido» que salió al arreglar lo anterior.
   *
   * El resto de `/pdf/*` va al motor, que exige credencial y roles; `generate` y `preview` se
   * desvían al worker, que sólo mira la clave de SERVICIO — y esa la pone el portal. Medido
   * contra el despliegue real: `GET /pdf/templates` sin sesión daba 401 y `POST /pdf/generate`
   * sin sesión daba 422, es decir, pasaba de largo. Cualquiera que alcanzara el portal podía
   * fabricar documentos con la identidad institucional.
   */
  it('no presta la clave del worker a quien no trae sesión', async () => {
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    process.env.PDF_WORKER_URL = 'http://pdf-worker:3100';
    process.env.PDF_WORKER_SERVICE_KEY = 'clave-de-servicio';
    const upstream = vi.spyOn(globalThis, 'fetch');

    const anonima = {
      method: 'POST',
      headers: new Headers(),
      nextUrl: new URL('https://portal.example/pdf/generate'),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as NextRequest;

    const response = await proxyDecisionEngine(anonima, ['pdf', 'generate']);

    expect(response.status).toBe(401);
    // Y lo que más importa: NO se llegó a llamar al worker. Rechazar después de haberle
    // mandado la petición dejaría la puerta abierta con un portero educado.
    expect(upstream).not.toHaveBeenCalled();
  });

  it('con sesión, adjunta la clave de servicio y sólo en el salto al worker', async () => {
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    process.env.PDF_WORKER_URL = 'http://pdf-worker:3100';
    process.env.PDF_WORKER_SERVICE_KEY = 'clave-de-servicio';
    const upstream = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const conSesion = {
      method: 'POST',
      headers: new Headers({ authorization: 'Bearer portal-token' }),
      nextUrl: new URL('https://portal.example/pdf/generate'),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as NextRequest;

    await proxyDecisionEngine(conSesion, ['pdf', 'generate']);

    const enviadas = upstream.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(enviadas.headers).get('x-pdf-service-key')).toBe('clave-de-servicio');
  });

  it('al MOTOR nunca le llega la clave del worker', async () => {
    // Una credencial no viaja a donde no hace falta: mandarla al motor la filtraría a un
    // destino que no la usa, multiplicando por dos los sitios desde donde se puede escapar.
    process.env.DECISION_ENGINE_URL = 'http://engine:3000';
    process.env.PDF_WORKER_URL = 'http://pdf-worker:3100';
    process.env.PDF_WORKER_SERVICE_KEY = 'clave-de-servicio';
    const upstream = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await proxyDecisionEngine(request('https://portal.example/v1/artifacts'), ['v1', 'artifacts']);

    const enviadas = upstream.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(enviadas.headers).get('x-pdf-service-key')).toBeNull();
  });
});
