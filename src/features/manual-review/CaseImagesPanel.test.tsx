import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaseImagesPanel } from './CaseImagesPanel';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn(() => new Promise(() => undefined)) }));
vi.mock('../../api/file-download', () => ({ apiDownload: vi.fn() }));

/**
 * Un caso sin `correlationId` no puede desaparecer del detalle: antes el panel devolvía `null` y
 * el analista no sabía si no había carnet o si la pantalla no lo traía.
 */
describe('documentos del solicitante en la revisión manual', () => {
  it('dice que no puede llegar a las imágenes cuando el caso no trae el intento', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CaseImagesPanel attemptId="" />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Documentos del solicitante')).toBeTruthy();
    expect(screen.getByText(/no se puede llegar a su carnet/)).toBeTruthy();
  });
});

describe('carnet desde el expediente cuando el registro del alta no sirve el archivo', () => {
  it('pide el expediente del cliente y pinta sus imágenes tras un 404 del contenido', async () => {
    const { apiRequest } = await import('../../api/http-client');
    const { apiDownload } = await import('../../api/file-download');
    const { ApiError } = await import('../../api/ApiError');
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:carnet');
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.mocked(apiRequest).mockImplementation(((ruta: string) => {
      if (ruta.includes('identity-verifications'))
        return Promise.resolve({
          customerId: '54',
          documents: [{ documentId: '9', documentType: 'identity_front', mimeType: 'image/jpeg' }],
        });
      if (ruta.includes('por-sujeto')) return Promise.resolve({ expedienteId: '54' });
      return Promise.resolve([
        {
          nodoId: '7',
          tipo: 'archivo',
          nombre: 'carnet-frente.jpg',
          clase: null,
          mimeType: 'image/jpeg',
          sha256: null,
          objetoAusente: false,
          borradoEn: null,
        },
      ]);
    }) as typeof apiRequest);
    vi.mocked(apiDownload).mockImplementation(((ruta: string) =>
      ruta.includes('customer-onboarding')
        ? Promise.reject(new ApiError('no', 404, 'EVIDENCE_DOCUMENT_NOT_FOUND'))
        : Promise.resolve({ blob: new Blob(['x']), fileName: 'x' })) as typeof apiDownload);

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CaseImagesPanel attemptId="abc" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/carnet-frente\.jpg/)).toBeTruthy();
    expect(
      vi
        .mocked(apiDownload)
        .mock.calls.some(([r]) => String(r).includes('/expedientes/54/nodos/7/contenido')),
    ).toBe(true);
  });
});
