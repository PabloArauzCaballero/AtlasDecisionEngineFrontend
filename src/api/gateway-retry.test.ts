import { ApiError } from './ApiError';
import {
  delayBeforeAttempt,
  deservesRetry,
  outageOf,
  outageOfError,
  retryModeFor,
  sessionRejected,
} from './gateway-retry';
import { apiRequest, configureHttpClient } from './http-client';

/**
 * El portal durante un despliegue del servicio de aguas abajo.
 *
 * Sus proxys de servidor ya dicen si llegaron o no (`*_UNAVAILABLE` frente a `*_TIMEOUT`), y esa
 * distinción es la que decide si repetir es seguro. Se prueba también lo que NO debe repetirse:
 * `PDF_WORKER_UNAUTHORIZED` es un 502 pero es una variable mal puesta, y repetirla 45 s sólo
 * retrasaría el mensaje que dice dónde mirar.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const texto = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain' } });

const NO_LLEGO = () => json(502, { code: 'DECISION_ENGINE_UNAVAILABLE', message: 'x' });
const PUDO_LLEGAR = () => json(504, { code: 'DECISION_ENGINE_TIMEOUT', message: 'x' });

describe('clasificación de la respuesta', () => {
  it('distingue «no llegué» de «no me contestaron a tiempo»', async () => {
    await expect(outageOf(NO_LLEGO())).resolves.toBe('not-delivered');
    await expect(outageOf(json(502, { code: 'ATLAS_BACKEND_UNAVAILABLE' }))).resolves.toBe(
      'not-delivered',
    );
    await expect(outageOf(PUDO_LLEGAR())).resolves.toBe('maybe-delivered');
  });

  it('un 502 de configuración del PDF no es una caída y no se repite', async () => {
    await expect(outageOf(json(502, { code: 'PDF_WORKER_UNAUTHORIZED' }))).resolves.toBeNull();
  });

  it('un 404/5xx sin JSON es de Traefik o del proxy: no llegó', async () => {
    await expect(outageOf(texto(404, '404 page not found'))).resolves.toBe('not-delivered');
    await expect(outageOf(texto(500, 'Internal Server Error'))).resolves.toBe('not-delivered');
  });

  it('un error de negocio del motor no es una caída', async () => {
    await expect(outageOf(json(500, { code: 'RULE_EVALUATION_FAILED' }))).resolves.toBeNull();
    await expect(outageOf(json(404, { code: 'NOT_FOUND' }))).resolves.toBeNull();
  });

  it('no consume el cuerpo: quien pidió la respuesta la recibe intacta', async () => {
    const response = NO_LLEGO();
    await outageOf(response);
    await expect(response.json()).resolves.toMatchObject({ code: 'DECISION_ENGINE_UNAVAILABLE' });
  });

  it('el corte de red pudo llegar; el plazo agotado del navegador no es una caída', () => {
    expect(outageOfError(new ApiError('x', 0, 'NETWORK_ERROR', undefined, 'network'))).toBe(
      'maybe-delivered',
    );
    // Lo mide el navegador contra el propio portal: un endpoint lento no debe costar 45 s de espera.
    expect(
      outageOfError(new ApiError('x', 408, 'REQUEST_TIMEOUT', undefined, 'timeout')),
    ).toBeNull();
    expect(outageOfError(new ApiError('x', 403, 'FORBIDDEN'))).toBeNull();
  });
});

describe('cuándo se cierra la sesión', () => {
  it('sólo si el servicio rechazó la credencial', () => {
    expect(sessionRejected(new ApiError('x', 401, 'UNAUTHORIZED'))).toBe(true);
    expect(sessionRejected(new ApiError('x', 403, 'FORBIDDEN'))).toBe(true);
  });

  it('nunca si el fallo fue de la red o de la pasarela', () => {
    // Es el fallo que echaba del portal a quien tenía un refresh token válido durante un despliegue.
    expect(sessionRejected(new ApiError('x', 0, 'NETWORK_ERROR', undefined, 'network'))).toBe(
      false,
    );
    expect(sessionRejected(new ApiError('x', 502, 'DECISION_ENGINE_UNAVAILABLE'))).toBe(false);
    expect(sessionRejected(new ApiError('x', 408, 'REQUEST_TIMEOUT', undefined, 'timeout'))).toBe(
      false,
    );
    expect(sessionRejected(new Error('boom'))).toBe(false);
  });
});

describe('qué operación se repite', () => {
  it('sólo las lecturas repiten lo que pudo haberse ejecutado', () => {
    expect(retryModeFor('GET')).toBe('safe');
    expect(retryModeFor('POST')).toBe('undelivered-only');
    expect(deservesRetry('maybe-delivered', 'safe')).toBe(true);
    expect(deservesRetry('maybe-delivered', 'undelivered-only')).toBe(false);
    expect(deservesRetry('not-delivered', 'undelivered-only')).toBe(true);
    expect(deservesRetry(null, 'safe')).toBe(false);
  });

  it('las esperas crecen, se estancan y se dispersan un 25 %', () => {
    expect([1, 5, 30].map((n) => delayBeforeAttempt(n, () => 0.5))).toEqual([1000, 8000, 8000]);
    expect(delayBeforeAttempt(1, () => 0)).toBe(750);
    expect(delayBeforeAttempt(1, () => 1)).toBe(1250);
  });
});

describe('apiRequest durante un despliegue', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function cliente(
    overrides: { refreshAccessToken?: () => Promise<string>; expireSession?: () => void } = {},
  ) {
    const expireSession = overrides.expireSession ?? vi.fn();
    const refreshAccessToken =
      overrides.refreshAccessToken ?? vi.fn().mockResolvedValue('new-token');
    const cleanup = configureHttpClient({
      getAccessToken: () => 'old-token',
      refreshAccessToken,
      expireSession,
    });
    return { cleanup, expireSession, refreshAccessToken };
  }

  async function correr<T>(promesa: Promise<T>) {
    const capturada = promesa.then(
      (valor) => ({ valor, error: null as unknown }),
      (error: unknown) => ({ valor: null as T | null, error }),
    );
    await vi.advanceTimersByTimeAsync(120_000);
    return capturada;
  }

  it('una lectura que cae en el hueco termina sola cuando vuelve el servicio', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(NO_LLEGO())
      .mockResolvedValueOnce(texto(404, '404 page not found'))
      .mockResolvedValueOnce(json(200, { ok: true }));
    const { cleanup } = cliente();

    const { valor, error } = await correr(apiRequest<{ ok: boolean }>('/v1/health'));

    expect(error).toBeNull();
    expect(valor).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    cleanup();
  });

  it('una escritura NO se repite ante un 504: pudo haberse ejecutado', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(PUDO_LLEGAR());
    const { cleanup } = cliente();

    const { error } = await correr(apiRequest('/v1/decisions', { method: 'POST', body: {} }));

    expect(error).toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('una escritura SÍ se repite ante un 502 que confirma que no llegó', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(NO_LLEGO())
      .mockResolvedValueOnce(json(201, { id: 7 }));
    const { cleanup } = cliente();

    const { valor } = await correr(
      apiRequest<{ id: number }>('/v1/decisions', { method: 'POST', body: {} }),
    );

    expect(valor).toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('un error de negocio no se repite', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(500, { code: 'RULE_EVALUATION_FAILED', message: 'x' }));
    const { cleanup } = cliente();

    await expect(apiRequest('/v1/health')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
