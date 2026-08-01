import { z } from 'zod';
import { apiEventStream, apiRequest, configureHttpClient } from './http-client';

function configureAuthenticatedClient(
  overrides: {
    refreshAccessToken?: () => Promise<string>;
    expireSession?: () => void;
  } = {},
) {
  const expireSession = overrides.expireSession ?? vi.fn();
  const refreshAccessToken = overrides.refreshAccessToken ?? vi.fn().mockResolvedValue('new-token');
  const cleanup = configureHttpClient({
    getAccessToken: () => 'old-token',
    refreshAccessToken,
    expireSession,
  });

  return { cleanup, expireSession, refreshAccessToken };
}

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('refreshes once after a 401 and retries with the new access token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const { cleanup, expireSession, refreshAccessToken } = configureAuthenticatedClient();

    await expect(apiRequest<{ ok: boolean }>('/v1/health')).resolves.toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get('authorization')).toBe(
      'Bearer new-token',
    );
    expect(expireSession).not.toHaveBeenCalled();
    cleanup();
  });

  it('does not expire a refreshed session when the retried request is forbidden', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 403 }));
    const { cleanup, expireSession } = configureAuthenticatedClient();

    await expect(apiRequest('/v1/restricted')).rejects.toMatchObject({
      status: 403,
      kind: 'forbidden',
    });
    expect(expireSession).not.toHaveBeenCalled();
    cleanup();
  });

  it('expires local state immediately when no token exists', async () => {
    const expireSession = vi.fn();
    const cleanup = configureHttpClient({
      getAccessToken: () => null,
      refreshAccessToken: vi.fn(),
      expireSession,
    });

    await expect(apiRequest('/v1/artifacts')).rejects.toMatchObject({ status: 401 });
    expect(expireSession).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('normalizes a request timeout', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const { cleanup } = configureAuthenticatedClient();

    const request = apiRequest('/v1/slow', { timeoutMs: 100 });
    const rejection = expect(request).rejects.toMatchObject({
      status: 408,
      code: 'REQUEST_TIMEOUT',
      kind: 'timeout',
    });

    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    cleanup();
  });

  it('propagates caller cancellation as a normalized error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const controller = new AbortController();
    const { cleanup } = configureAuthenticatedClient();

    const request = apiRequest('/v1/search', { signal: controller.signal });
    const rejection = expect(request).rejects.toMatchObject({
      status: 499,
      code: 'REQUEST_ABORTED',
      kind: 'cancelled',
    });

    controller.abort();
    await rejection;
    cleanup();
  });

  it('rejects a successful payload that violates its runtime contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: 'yes' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { cleanup } = configureAuthenticatedClient();

    await expect(
      apiRequest('/v1/health', {
        responseSchema: z.object({ ok: z.boolean() }),
      }),
    ).rejects.toMatchObject({
      status: 502,
      code: 'RESPONSE_CONTRACT_MISMATCH',
      kind: 'contract',
    });
    cleanup();
  });

  it('rejects absolute and protocol-relative API paths', async () => {
    const { cleanup } = configureAuthenticatedClient();

    await expect(apiRequest('https://example.com/v1/data')).rejects.toMatchObject({
      code: 'INVALID_API_PATH',
    });
    await expect(apiRequest('//example.com/v1/data')).rejects.toMatchObject({
      code: 'INVALID_API_PATH',
    });
    cleanup();
  });
});

describe('apiEventStream (Fase 8 — live execution)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function sseResponse(frames: string): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(frames));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }

  it('parses each SSE frame and calls onEvent with its type and JSON data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse(
        'event: node_step\ndata: {"nodeKey":"START","status":"RUNNING"}\n\n' +
          'event: execution_completed\ndata: {"outcome":"APPROVED"}\n\n',
      ),
    );
    const { cleanup } = configureAuthenticatedClient();
    const events: Array<{ type: string; data: unknown }> = [];

    await apiEventStream('/v1/live-executions/stream', (event) => events.push(event));

    expect(events).toEqual([
      { type: 'node_step', data: { nodeKey: 'START', status: 'RUNNING' } },
      { type: 'execution_completed', data: { outcome: 'APPROVED' } },
    ]);
    cleanup();
  });

  it('skips a malformed frame instead of failing the whole stream', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse(
        'event: node_step\ndata: {not json}\n\nevent: node_step\ndata: {"nodeKey":"OK"}\n\n',
      ),
    );
    const { cleanup } = configureAuthenticatedClient();
    const events: Array<{ type: string; data: unknown }> = [];

    await apiEventStream('/v1/live-executions/stream', (event) => events.push(event));

    expect(events).toEqual([{ type: 'node_step', data: { nodeKey: 'OK' } }]);
    cleanup();
  });

  it('entrega el último evento aunque el servidor cierre sin la línea en blanco', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      // Sin el `\n\n` final: es justo el `execution_completed`, el evento que
      // trae el resultado, el que se perdía.
      sseResponse('event: execution_completed\ndata: {"outcome":"APPROVED"}'),
    );
    const { cleanup } = configureAuthenticatedClient();
    const events: Array<{ type: string; data: unknown }> = [];

    await apiEventStream('/v1/live-executions/stream', (event) => events.push(event));

    expect(events).toEqual([{ type: 'execution_completed', data: { outcome: 'APPROVED' } }]);
    cleanup();
  });

  it('cierra la conexión abierta en vez de dejarla drenando', async () => {
    let cancelled = false;
    const abort = new AbortController();
    // Un flujo que NO se cierra solo: es el caso que importa, el de una
    // ejecución en curso que alguien abandona. Sobre uno ya cerrado, cancelar
    // es inerte por especificación y no probaría nada.
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: node_step\ndata: {"nodeKey":"A"}\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));
    const { cleanup } = configureAuthenticatedClient();

    await apiEventStream('/v1/live-executions/stream', () => abort.abort(), {
      signal: abort.signal,
    });

    expect(cancelled).toBe(true);
    cleanup();
  });

  it('tratar la cancelación como un final normal, no como un error', async () => {
    const controller = new AbortController();
    const stream = new ReadableStream({
      start(streamController) {
        streamController.enqueue(
          new TextEncoder().encode('event: node_step\ndata: {"nodeKey":"A"}\n\n'),
        );
        // Nunca se cierra: se queda esperando, como una ejecución en curso.
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));
    const { cleanup } = configureAuthenticatedClient();

    const done = apiEventStream('/v1/live-executions/stream', () => controller.abort(), {
      signal: controller.signal,
    });

    // Abandonar la vista o relanzar no es un fallo: no debe pintar un error.
    await expect(done).resolves.toBeUndefined();
    cleanup();
  });
});
