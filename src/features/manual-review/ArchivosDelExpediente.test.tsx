import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaseImagesPanel } from './CaseImagesPanel';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn(() => new Promise(() => undefined)) }));
vi.mock('../../api/file-download', () => ({ apiDownload: vi.fn() }));

/**
 * El 2026-10-07 quien revisaba un comercio no veía ninguno de sus documentos: el panel sólo traía
 * los archivos `image/*` del expediente, y un comercio sube matrícula, NIT y poder en PDF.
 */
describe('un comercio sube PDF, no fotos: ningún archivo se esconde por su tipo', () => {
  it('lista el PDF con ver y descargar, y dice cuál falta en el almacén', async () => {
    const { apiRequest } = await import('../../api/http-client');
    const { apiDownload } = await import('../../api/file-download');
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:pdf');
    globalThis.URL.revokeObjectURL = vi.fn();
    const nodo = (nodoId: string, nombre: string, mimeType: string | null, ausente = false) => ({
      nodoId,
      tipo: 'archivo',
      nombre,
      clase: null,
      mimeType,
      sha256: null,
      objetoAusente: ausente,
      borradoEn: null,
    });
    vi.mocked(apiRequest).mockImplementation(((ruta: string) =>
      ruta.includes('por-sujeto')
        ? Promise.resolve({ expedienteId: '12' })
        : Promise.resolve([
            nodo('3', 'matricula-de-comercio.pdf', 'application/pdf'),
            // El almacén no supo decir el tipo: lo resuelve la extensión.
            nodo('4', 'poder-del-representante.pdf', 'application/octet-stream'),
            nodo('5', 'nit.pdf', 'application/pdf', true),
          ])) as typeof apiRequest);
    vi.mocked(apiDownload).mockClear();
    vi.mocked(apiDownload).mockResolvedValue({ blob: new Blob(['%PDF']), fileName: 'x' } as never);

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CaseImagesPanel attemptId="" requestId="kyb-77-abc123" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('matricula-de-comercio.pdf')).toBeTruthy();
    expect(screen.getByText('poder-del-representante.pdf')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Ver aquí' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Descargar' })).toHaveLength(2);
    // El que falta se nombra y se explica; no se descarga ni desaparece.
    expect(screen.getByText('nit.pdf')).toBeTruthy();
    expect(screen.getByText(/no está en el almacén/)).toBeTruthy();
    expect(vi.mocked(apiDownload).mock.calls).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver aquí' })[0] as HTMLElement);
    expect(screen.getByTitle('matricula-de-comercio.pdf').tagName).toBe('IFRAME');
  });

  it('un expediente vacío se dice, no se disfraza de «sin imágenes»', async () => {
    const { apiRequest } = await import('../../api/http-client');
    vi.mocked(apiRequest).mockImplementation(((ruta: string) =>
      ruta.includes('por-sujeto')
        ? Promise.resolve({ expedienteId: '12' })
        : Promise.resolve([])) as typeof apiRequest);

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CaseImagesPanel attemptId="" requestId="kyb-78-abc123" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/no tiene ningún archivo/)).toBeTruthy();
  });
});

describe('tipoDeArchivo', () => {
  it('manda el tipo declarado y, si no dice nada, la extensión', async () => {
    const { tipoDeArchivo } = await import('./expediente-images');
    expect(tipoDeArchivo('a.pdf', 'application/pdf')).toBe('application/pdf');
    expect(tipoDeArchivo('a.PDF', 'application/octet-stream')).toBe('application/pdf');
    expect(tipoDeArchivo('foto.jpeg', null)).toBe('image/jpeg');
    expect(tipoDeArchivo('raro.xyz', null)).toBe('application/octet-stream');
  });
});
