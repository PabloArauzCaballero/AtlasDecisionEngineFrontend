import type { NextRequest } from 'next/server';
import { GET } from './route.next';

/**
 * Las métricas del motor no pueden salir por el portal sin que alguien lo
 * decida. La ruta reenviaba `/metrics` a cualquiera que la pidiese.
 */

function request(headers: Record<string, string> = {}): NextRequest {
  return {
    method: 'GET',
    headers: new Headers(headers),
    nextUrl: new URL('https://portal.example/metrics'),
  } as unknown as NextRequest;
}

describe('/metrics', () => {
  const previous = process.env.METRICS_SCRAPE_TOKEN;
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('atlas_requests_total 42', { status: 200 }),
    );
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.METRICS_SCRAPE_TOKEN;
    else process.env.METRICS_SCRAPE_TOKEN = previous;
    vi.restoreAllMocks();
  });

  it('no existe cuando el despliegue no la habilita, y no toca el motor', async () => {
    delete process.env.METRICS_SCRAPE_TOKEN;
    const response = await GET(request());

    expect(response.status).toBe(404);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('rechaza sin credencial y con credencial equivocada', async () => {
    process.env.METRICS_SCRAPE_TOKEN = 'secreto-de-raspado';

    expect((await GET(request())).status).toBe(401);
    expect((await GET(request({ authorization: 'Bearer otro' }))).status).toBe(401);
    // Ni un solo intento fallido debe llegar al motor: si llegara, esta puerta
    // sería un adorno y el límite de frecuencia del motor haría el trabajo.
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('reenvía sólo con la credencial correcta', async () => {
    process.env.METRICS_SCRAPE_TOKEN = 'secreto-de-raspado';
    const response = await GET(request({ authorization: 'Bearer secreto-de-raspado' }));

    expect(response.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain('/metrics');
  });
});
