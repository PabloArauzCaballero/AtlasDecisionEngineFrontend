import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDownload } from '../../api/file-download';
import { CasoDeArbitraje } from './IdentityArbitrationCase';
import type { IdentityReviewItem } from './identity-review';

vi.mock('../../api/file-download', () => ({ apiDownload: vi.fn() }));
vi.mock('./identity-review.api', () => ({
  claimIdentityReview: vi.fn(),
  resolveIdentityReview: vi.fn(),
}));
const descarga = vi.mocked(apiDownload);

/**
 * Cuándo se traen las imágenes de un caso de la cola.
 *
 * Esta prueba existe por un fallo que el panel introducía y que no se ve mirando la pantalla: la
 * cola pinta veinticinco casos cerrados, y montar el panel sin guarda descargaba el carnet y la
 * cara de las veinticinco personas para enseñar una lista de resúmenes. No rompe nada visible
 * —sólo mueve megas de PII que nadie va a mirar y retrasa la carga— y por eso hace falta fijarlo
 * aquí: es exactamente la clase de defecto que vuelve en el siguiente refactor.
 */
function caso(overrides: Partial<IdentityReviewItem> = {}): IdentityReviewItem {
  return {
    requestId: 'req-1',
    requestedBy: 'analista@atlas',
    status: 'PENDING_REVIEW',
    reviewReason: 'DOUBTFUL_DOCUMENT',
    reviewPriority: 1,
    arbitrationMode: 'HUMAN',
    documentType: null,
    documentCountry: 'BO',
    documentTypeConfidence: 0.62,
    errorCode: null,
    errorMessage: null,
    reviewOpenedAt: '2026-09-04T12:00:00.000Z',
    pendingMs: 60_000,
    reviewClaimedBy: null,
    reviewClaimedAt: null,
    queuedAt: '2026-09-04T11:59:00.000Z',
    ...overrides,
  };
}

function pintar(item = caso()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CasoDeArbitraje item={item} />
    </QueryClientProvider>,
  );
}

describe('caso de arbitraje de identidad', () => {
  beforeEach(() => {
    descarga.mockReset();
    descarga.mockResolvedValue({ blob: new Blob(['x'], { type: 'image/jpeg' }), fileName: 'x' });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('con el caso CERRADO no pide ninguna imagen', async () => {
    pintar();

    // Se espera activamente un poco: si el panel se montara, la descarga saldría en este hueco.
    await waitFor(() => expect(screen.getByText(/Evidencia 62 %/)).toBeInTheDocument());
    expect(descarga).not.toHaveBeenCalled();
  });

  it('al ABRIR el caso trae las imágenes de esa ejecución y sólo de ésa', async () => {
    const { container } = pintar(caso({ requestId: 'req-99' }));
    const detalle = container.querySelector('details');
    if (!detalle) throw new Error('el caso debería renderizar un <details>');

    // `open` + `toggle` es lo que hace el navegador al pulsar el resumen; jsdom no lo dispara solo.
    // Va en `act` porque el manejador cambia estado de React y montar el panel es esa consecuencia.
    act(() => {
      detalle.open = true;
      detalle.dispatchEvent(new Event('toggle'));
    });

    await waitFor(() => expect(descarga).toHaveBeenCalledTimes(3));
    for (const [ruta] of descarga.mock.calls) {
      expect(ruta).toContain('/runs/req-99/images/');
    }
  });
});
