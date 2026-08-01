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

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.DECISION_ENGINE_URL;
    else process.env.DECISION_ENGINE_URL = previousUrl;
    if (previousTrust === undefined) delete process.env.TRUSTED_PROXY;
    else process.env.TRUSTED_PROXY = previousTrust;
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
});
