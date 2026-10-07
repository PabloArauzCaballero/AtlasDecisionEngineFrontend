import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDownload } from '../../api/file-download';
import contract from '../../contracts/fixtures/audit-execution.example.json';
import { flattenExecution } from './execution-record';
import { ExecutionIdentityEvidence, identityStepsOf } from './ExecutionIdentityEvidence';

vi.mock('../../api/file-download', () => ({ apiDownload: vi.fn() }));
const descarga = vi.mocked(apiDownload);

function pintar(traceSteps: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ExecutionIdentityEvidence traceSteps={traceSteps} />
    </QueryClientProvider>,
  );
}

describe('carnet y selfie en el detalle de ejecución', () => {
  const execution = flattenExecution(contract as Record<string, unknown>);

  beforeEach(() => {
    descarga.mockReset();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('encuentra el paso de identidad del contrato y su corrida de evidencia', () => {
    expect(identityStepsOf(execution.traceSteps)).toEqual([
      { nodeKey: 'VERIFICAR_IDENTIDAD', evidenceRequestId: 'idv-contrato-0001' },
    ]);
  });

  it('pide las imágenes de esa corrida por la puerta autenticada', async () => {
    descarga.mockResolvedValue({ blob: new Blob(['x']), fileName: 'x' });
    pintar(execution.traceSteps);

    await waitFor(() => expect(descarga).toHaveBeenCalledTimes(3));
    expect(descarga.mock.calls[0][0]).toBe(
      '/v1/workers/identity-verification/runs/idv-contrato-0001/images/document',
    );
  });

  it('un paso de identidad sin evidencia dice por qué, en vez de quedar vacío', () => {
    pintar([
      {
        nodeKey: 'VERIFICAR_IDENTIDAD',
        evaluationResultJson: { worker: { service: 'identity-verification' } },
      },
    ]);

    expect(screen.getByText(/no conservó sus imágenes/)).toBeTruthy();
    expect(descarga).not.toHaveBeenCalled();
  });

  it('sin pasos de identidad no pinta nada', () => {
    pintar([{ nodeKey: 'RIESGO', evaluationResultJson: { score: 1 } }]);

    expect(screen.queryByText('Documento de identidad')).toBeNull();
  });
});
