import { apiDownload } from './file-download';
import { configureHttpClient } from './http-client';

function authenticatedClient() {
  return configureHttpClient({
    getAccessToken: () => 'token',
    refreshAccessToken: () => Promise.resolve('token'),
    expireSession: vi.fn(),
  });
}

function acceptOf(mock: { mock: { calls: unknown[][] } }, call = 0): string | null {
  const init = mock.mock.calls[call]?.[1] as RequestInit | undefined;
  return (init?.headers as Headers | undefined)?.get('accept') ?? null;
}

describe('apiDownload', () => {
  afterEach(() => vi.restoreAllMocks());

  it('deja llegar al servidor el tipo que pidió quien descarga', async () => {
    /*
     * Regresión medida: el cliente HTTP fijaba `accept: application/json` pasando
     * por encima de lo que pedía quien llamaba. `POST /pdf/generate` responde el
     * ARCHIVO o la FICHA según esa cabecera, así que devolvía 200 con el JSON de
     * metadatos, la descarga lo daba por bueno y el archivo guardado con
     * extensión `.pdf` era un PDF corrupto. Nada fallaba en el camino: por eso la
     * comprobación es sobre la cabecera que sale, no sobre el resultado.
     */
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['%PDF-1.4']), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    );
    const cleanup = authenticatedClient();

    await apiDownload('/pdf/generate', 'respaldo.pdf', {
      method: 'POST',
      headers: { accept: 'application/pdf' },
      body: { templateId: 'generic-result-report' },
    });

    expect(acceptOf(fetchMock)).toBe('application/pdf');
    cleanup();
  });

  it('pide cualquier tipo cuando quien descarga no elige uno', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new Blob(['a,b']), { status: 200 }));
    const cleanup = authenticatedClient();

    await apiDownload('/pdf/template-format/example', 'ejemplo.json');

    expect(acceptOf(fetchMock)).toBe('*/*');
    cleanup();
  });

  it('se niega a guardar un 200 cuyo tipo no es el que se pidió', async () => {
    // La ficha en JSON con la que el motor responde cuando no se le pidió el
    // archivo. Antes se guardaba tal cual con extensión `.pdf`.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ documentId: 'DOC-1', status: 'GENERATED' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const cleanup = authenticatedClient();

    await expect(
      apiDownload('/pdf/generate', 'informe.pdf', { headers: { accept: 'application/pdf' } }),
    ).rejects.toMatchObject({ code: 'DOWNLOAD_WRONG_CONTENT_TYPE' });
    cleanup();
  });

  it('prefiere el nombre que propone el servidor al de respaldo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['%PDF-1.4']), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition':
            'attachment; filename="informe.pdf"; filename*=UTF-8\'\'informe.pdf',
        },
      }),
    );
    const cleanup = authenticatedClient();

    await expect(apiDownload('/pdf/generate', 'respaldo.pdf')).resolves.toMatchObject({
      fileName: 'informe.pdf',
    });
    cleanup();
  });
});
