import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveExecutionSampleBar } from './LiveExecutionSampleBar';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const { apiRequest } = await import('../../api/http-client');
const mockedApiRequest = vi.mocked(apiRequest);

/**
 * La pantalla de ejecución en vivo arrancaba con `{}` y el algoritmo real
 * declara decenas de entradas obligatorias: lo único que se podía obtener al
 * pulsar «Iniciar» era VARIABLE_MISSING_OR_INVALID. Para ver una sola ejecución
 * había que teclear el contrato entero a mano.
 */
const CONTRACT = {
  variables: [
    { variableCode: 'age', dataType: 'INTEGER', usageType: 'INPUT', isRequired: true },
    { variableCode: 'kyc_status', dataType: 'STRING', usageType: 'INPUT', isRequired: true },
    // Una salida: la produce el motor, no se le pide a quien ejecuta.
    { variableCode: 'decision_outcome', dataType: 'STRING', usageType: 'OUTPUT_PRIMARY' },
  ],
};

function renderBar(artifactCode = 'BNPL_CREDIT_DECISION') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LiveExecutionSampleBar
        artifactCode={artifactCode}
        environmentCode="DEV"
        onLoad={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe('valores de prueba en la ejecución en vivo', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    mockedApiRequest.mockResolvedValue(CONTRACT as never);
  });

  it('pide el contrato del artefacto elegido', async () => {
    renderBar();
    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalled());
    expect(String(mockedApiRequest.mock.calls[0][0])).toContain(
      '/v1/views/artifact-inputs?artifactCode=BNPL_CREDIT_DECISION',
    );
  });

  it('ofrece generar valores, que es lo que faltaba para poder ejecutar', async () => {
    renderBar();
    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalled());
    // Tipo y cantidad: los dos controles que pedía el analista.
    expect(await screen.findByRole('button', { name: /Generar/i })).toBeInTheDocument();
  });

  it('sin artefacto elegido no consulta nada: no hay contrato que resolver', () => {
    renderBar('');
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });
});
