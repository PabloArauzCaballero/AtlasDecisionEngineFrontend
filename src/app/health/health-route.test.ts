import type { NextRequest } from 'next/server';
import { GET } from './[[...path]]/route.next';

/**
 * `/health/*` reenviaba cualquier ruta al motor, y `health/data-sources` contesta sin sesión con
 * la topología de datos. Sólo pasan las sondas que usan la pantalla de estado y el smoke.
 */

function request(path: string): NextRequest {
  return {
    method: 'GET',
    headers: new Headers(),
    nextUrl: new URL(`https://portal.example${path}`),
    signal: new AbortController().signal,
  } as unknown as NextRequest;
}

const context = (path?: string[]) => ({ params: Promise.resolve({ path }) });

describe('/health', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"status":"UP"}', { status: 200 }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('health/data-sources no sale del portal', async () => {
    const response = await GET(request('/health/data-sources'), context(['data-sources']));
    expect(response.status).toBe(404);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('health/ready sí se reenvía al motor', async () => {
    const response = await GET(request('/health/ready'), context(['ready']));
    expect(response.status).toBe(200);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toMatch(/\/health\/ready$/);
  });
});
