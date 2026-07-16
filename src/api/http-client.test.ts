import { apiRequest, configureHttpClient } from './http-client';

describe('apiRequest', () => {
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
    const refreshAccessToken = vi.fn().mockResolvedValue('new-token');
    const expireSession = vi.fn();
    const cleanup = configureHttpClient({
      getAccessToken: () => 'old-token',
      refreshAccessToken,
      expireSession,
    });

    await expect(apiRequest<{ ok: boolean }>('/v1/health')).resolves.toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual(expect.objectContaining({}));
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get('authorization')).toBe(
      'Bearer new-token',
    );
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
});
