import { z } from 'zod';
import { apiRequest, configureHttpClient } from './http-client';

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
    await vi.advanceTimersByTimeAsync(100);

    await expect(request).rejects.toMatchObject({
      status: 408,
      code: 'REQUEST_TIMEOUT',
      kind: 'timeout',
    });
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
    controller.abort();

    await expect(request).rejects.toMatchObject({
      status: 499,
      code: 'REQUEST_ABORTED',
      kind: 'cancelled',
    });
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
