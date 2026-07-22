import type { NextRequest } from 'next/server';
import { proxyDecisionEngine } from './decision-engine-proxy';

function request(url: string): NextRequest {
  return {
    method: 'GET',
    headers: new Headers({ authorization: 'Bearer portal-token' }),
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

describe('decision engine proxy', () => {
  const previousUrl = process.env.DECISION_ENGINE_URL;

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.DECISION_ENGINE_URL;
    else process.env.DECISION_ENGINE_URL = previousUrl;
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

  it('rejects non-HTTP destinations without issuing an upstream request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    process.env.DECISION_ENGINE_URL = 'file:///etc/passwd';

    const response = await proxyDecisionEngine(request('https://portal.example/health'), [
      'health',
    ]);

    expect(response.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
