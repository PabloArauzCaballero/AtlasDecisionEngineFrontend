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

describe('comercio del ERP: el caso se ata a su expediente por el requestId', () => {
  it('sin intento de verificación pide el expediente partner y enlaza a él', async () => {
    const { apiRequest } = await import('../../api/http-client');
    const { apiDownload } = await import('../../api/file-download');
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:rut');
    globalThis.URL.revokeObjectURL = vi.fn();
    const pedidas: string[] = [];
    vi.mocked(apiRequest).mockImplementation(((ruta: string) => {
      pedidas.push(ruta);
      if (ruta.includes('por-sujeto')) return Promise.resolve({ expedienteId: '12' });
      return Promise.resolve([
        {
          nodoId: '3',
          tipo: 'archivo',
          nombre: 'nit.png',
          clase: null,
          mimeType: 'image/png',
          sha256: null,
          objetoAusente: false,
          borradoEn: null,
        },
      ]);
    }) as typeof apiRequest);
    vi.mocked(apiDownload).mockResolvedValue({ blob: new Blob(['x']), fileName: 'x' } as never);

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CaseImagesPanel attemptId="" requestId="kyb-77-abc123" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/nit\.png/)).toBeTruthy();
    expect(pedidas.some((r) => r.endsWith('/expedientes/por-sujeto/partner/77'))).toBe(true);
  });
});

describe('sujetoDelCaso', () => {
  it('lee comercio e identidad del requestId y descarta el resto', async () => {
    const { sujetoDelCaso } = await import('./expediente-images');
    expect(sujetoDelCaso('kyb-77-abc')).toEqual({ tipo: 'partner', id: '77' });
    expect(sujetoDelCaso('identity-54-9f2')).toEqual({ tipo: 'customer', id: '54' });
    expect(sujetoDelCaso('16314699-dba4-4e09-a35b-4bb71964c7ea')).toBeNull();
  });
});

describe('el expediente es un extra cuando ya hay carnet', () => {
  it('si su lectura falla, el carnet del alta se sigue viendo', async () => {
    const { apiRequest } = await import('../../api/http-client');
    const { apiDownload } = await import('../../api/file-download');
    const { ApiError } = await import('../../api/ApiError');
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:ok');
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.mocked(apiRequest).mockImplementation(((ruta: string) =>
      ruta.includes('identity-verifications')
        ? Promise.resolve({
            customerId: '54',
            documents: [{ documentId: '9', documentType: 'identity_front', mimeType: 'image/png' }],
          })
        : Promise.reject(new ApiError('Sin permiso', 403, 'FORBIDDEN'))) as typeof apiRequest);
    vi.mocked(apiDownload).mockResolvedValue({ blob: new Blob(['x']), fileName: 'x' } as never);

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CaseImagesPanel attemptId="abc" requestId="" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/Anverso del carnet/)).toBeTruthy();
  });
});

describe('caso viejo sin cliente: el analista indica el expediente', () => {
  it('con IDENTITY_ATTEMPT_NOT_FOUND ofrece el número de expediente y pinta sus imágenes', async () => {
    const { apiRequest } = await import('../../api/http-client');
    const { apiDownload } = await import('../../api/file-download');
    const { ApiError } = await import('../../api/ApiError');
    const { fireEvent } = await import('@testing-library/react');
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:c');
    globalThis.URL.revokeObjectURL = vi.fn();
    const pedidas: string[] = [];
    vi.mocked(apiRequest).mockImplementation(((ruta: string) => {
      pedidas.push(ruta);
      if (ruta.includes('identity-verifications'))
        return Promise.reject(new ApiError('no', 404, 'IDENTITY_ATTEMPT_NOT_FOUND'));
      return Promise.resolve([
        {
          nodoId: '8',
          tipo: 'archivo',
          nombre: 'carnet-54.jpg',
          clase: null,
          mimeType: 'image/jpeg',
          sha256: null,
          objetoAusente: false,
          borradoEn: null,
        },
      ]);
    }) as typeof apiRequest);
    vi.mocked(apiDownload).mockResolvedValue({ blob: new Blob(['x']), fileName: 'x' } as never);

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CaseImagesPanel attemptId="abc" requestId="16314699-dba4-4e09-a35b-4bb71964c7ea" />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Indicar el expediente a mano' }));
    const campo = await screen.findByPlaceholderText('54');
    fireEvent.change(campo, { target: { value: '54' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver imágenes' }));

    expect(await screen.findByText(/carnet-54\.jpg/)).toBeTruthy();
    expect(pedidas.some((r) => r.includes('/expedientes/54/nodos'))).toBe(true);
  });
});
