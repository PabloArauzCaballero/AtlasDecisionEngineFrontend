import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDownload } from '../../api/file-download';
import { elegirOpcion, esperarOpcion, valorDe } from '../../test/option-select';
import { StatementDocumentViewer } from './StatementDocumentViewer';
import { StatementInstitutionAssign } from './StatementInstitutionAssign';
import { fetchInstitutionSummary, fetchInstitutions } from './institutions.api';
import { reprocessStatementReview } from './statement-review.api';
import type { StatementReviewDetail } from './statement-review';

vi.mock('../../api/file-download', () => ({ apiDownload: vi.fn() }));
vi.mock('./institutions.api', async (importar) => ({
  ...(await importar<typeof import('./institutions.api')>()),
  fetchInstitutions: vi.fn(),
  fetchInstitutionSummary: vi.fn(),
}));
vi.mock('./statement-review.api', async (importar) => ({
  ...(await importar<typeof import('./statement-review.api')>()),
  reprocessStatementReview: vi.fn(),
}));
vi.mock('../../notifications/useNotifications', () => ({
  useNotifications: () => ({ notify: vi.fn(), promise: <T,>(p: Promise<T>) => p }),
}));

const descarga = vi.mocked(apiDownload);
const padron = vi.mocked(fetchInstitutions);
const resumen = vi.mocked(fetchInstitutionSummary);
const reprocesar = vi.mocked(reprocessStatementReview);

function envolver(hijo: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{hijo}</QueryClientProvider>);
}

/**
 * 2026-10-15 — Pablo: «no me deja ver el PDF subido, para poder manualmente ponerle la entidad».
 */
describe('revisión de un extracto · el PDF y la entidad', () => {
  beforeEach(() => {
    descarga.mockReset();
    descarga.mockResolvedValue({
      blob: new Blob(['%PDF'], { type: 'application/pdf' }),
      fileName: 'x.pdf',
    });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:pdf');
    globalThis.URL.revokeObjectURL = vi.fn();
    padron.mockResolvedValue([
      { code: 'BNB', name: 'Banco Nacional de Bolivia S.A.', licenseStatus: 'LICENSED' },
    ] as never);
    resumen.mockResolvedValue({
      active: 1,
      byKind: {},
      withoutLicense: 0,
      missingFromSeed: ['BGA'],
    });
    reprocesar.mockResolvedValue({});
  });

  it('el PDF se pide sólo al abrir el visor, con la sesión, y se muestra en un marco', async () => {
    envolver(<StatementDocumentViewer requestId="bs-1" fileName="x.pdf" available />);
    expect(descarga).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver el PDF subido' }));
    await waitFor(() =>
      expect(descarga).toHaveBeenCalledWith(
        '/v1/workers/bank-statement/reviews/bs-1/document',
        'x.pdf',
        expect.anything(),
      ),
    );
    expect(await screen.findByTitle('Extracto x.pdf')).toHaveAttribute('src', 'blob:pdf');
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeInTheDocument();
  });

  it('sin PDF guardado lo dice y no ofrece abrirlo', () => {
    envolver(<StatementDocumentViewer requestId="bs-1" fileName="x.pdf" available={false} />);
    expect(screen.queryByRole('button', { name: 'Ver el PDF subido' })).toBeNull();
    expect(screen.getByText(/ya no está guardado/)).toBeInTheDocument();
  });

  it('asignar la entidad reprocesa con ella; las de la nómina que faltan en el padrón también se ofrecen', async () => {
    const detalle = {
      requestId: 'bs-1',
      documentAvailable: true,
      assignedInstitution: null,
    } as unknown as StatementReviewDetail;
    const hecho = vi.fn();
    envolver(<StatementInstitutionAssign detalle={detalle} onDone={hecho} />);
    const selector = () => screen.getByRole('combobox', { name: /Entidad que emitió el extracto/ });
    await esperarOpcion(selector, 'BGA');
    await esperarOpcion(selector, 'BNB');
    elegirOpcion(selector(), 'BGA');
    expect(valorDe(selector())).toBe('BGA');
    fireEvent.click(screen.getByRole('button', { name: 'Reprocesar con esta entidad' }));
    await waitFor(() => expect(reprocesar).toHaveBeenCalledWith('bs-1', 'BGA'));
    await waitFor(() => expect(hecho).toHaveBeenCalled());
  });
});
