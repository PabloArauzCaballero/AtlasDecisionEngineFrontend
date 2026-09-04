import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/ApiError';
import { apiDownload } from '../../api/file-download';
import { ImagenesDeLaEjecucion } from './IdentityRunImagesPanel';

vi.mock('../../api/file-download', () => ({ apiDownload: vi.fn() }));
const descarga = vi.mocked(apiDownload);

/**
 * Las imágenes del caso que se arbitra.
 *
 * Lo que se fija aquí es lo que distingue «se ve el carnet» de «se cree que se ve»: que un caso sin
 * reverso siga enseñando las otras dos, que una ejecución vieja lo DIGA en vez de aparecer vacía, y
 * que un fallo de verdad no se disfrace de ausencia — porque decidir sobre la identidad de alguien
 * creyendo que no hay imágenes, cuando lo que pasa es que no se pudieron traer, es el error que
 * esta pantalla existe para no cometer.
 */
function imagen(nombre: string) {
  return { blob: new Blob([nombre], { type: 'image/jpeg' }), fileName: nombre };
}

function pintar(requestId = 'req-1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ImagenesDeLaEjecucion requestId={requestId} />
    </QueryClientProvider>,
  );
}

describe('imágenes de la ejecución de identidad', () => {
  beforeEach(() => {
    descarga.mockReset();
    // `createObjectURL` no existe en jsdom: el componente lo usa para pintar el blob sin exponer
    // una URL pública, así que se sustituye por algo estable y legible en los asertos.
    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => `blob:${String(blob.size)}`);
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('pide las tres imágenes por la puerta autenticada, nunca por src directo', async () => {
    descarga.mockResolvedValue(imagen('x'));
    pintar('req-42');

    await waitFor(() => expect(descarga).toHaveBeenCalledTimes(3));
    const rutas = descarga.mock.calls.map(([ruta]) => ruta);
    expect(rutas).toEqual([
      '/v1/workers/identity-verification/runs/req-42/images/document',
      '/v1/workers/identity-verification/runs/req-42/images/documentBack',
      '/v1/workers/identity-verification/runs/req-42/images/selfie',
    ]);
  });

  it('un 404 en el reverso NO esconde el anverso ni la selfie', async () => {
    // Es el caso normal —sólo anverso y selfie son obligatorios—, y tratarlo como error dejaría al
    // analista sin ver nada por faltar una imagen que puede no existir.
    descarga.mockImplementation((ruta: string) =>
      ruta.endsWith('/documentBack')
        ? Promise.reject(new ApiError('no está', 404))
        : Promise.resolve(imagen(ruta)),
    );
    pintar();

    expect(await screen.findByText('Anverso del carnet')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.queryByText('Reverso del carnet')).not.toBeInTheDocument();
  });

  it('dice por qué una ejecución vieja no tiene imágenes, en vez de aparecer vacía', async () => {
    descarga.mockRejectedValue(new ApiError('no está', 404));
    pintar();

    expect(await screen.findByText(/no conservó sus imágenes/)).toBeInTheDocument();
  });

  it('un fallo real se avisa: no se puede decidir creyendo que no hay imágenes', async () => {
    // 401/500 significan que las imágenes EXISTEN y no se están pudiendo traer. Silenciarlo sería
    // indistinguible del caso anterior y llevaría a resolver a ciegas.
    descarga.mockRejectedValue(new ApiError('caído', 500));
    pintar();

    expect(await screen.findByText(/No se pudieron traer las imágenes/)).toBeInTheDocument();
  });
});
