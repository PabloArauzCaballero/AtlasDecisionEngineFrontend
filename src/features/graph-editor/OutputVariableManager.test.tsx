import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiRequest } from '../../api/http-client';
import { OutputVariableManager } from './OutputVariableManager';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

function renderManager() {
  const onChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <OutputVariableManager variables={[]} onChange={onChange} />
    </QueryClientProvider>,
  );
  return onChange;
}

describe('OutputVariableManager', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    // The slim picker shape: it exposes `latestVersionId` directly. The previous
    // implementation read `versions[0].id` from the full list (absent here), so it
    // silently added nothing — this test pins the fix.
    mockedApiRequest.mockResolvedValue([
      {
        definitionId: 'def-1',
        variableCode: 'scoring',
        latestVersionId: 'ver-9',
        dataType: 'NUMBER',
        nullable: false,
        isSensitive: false,
        versionNumber: 1,
      },
    ] as never);
  });

  it('adds an output from the catalog using the picker version id', async () => {
    const onChange = renderManager();
    // Espera larga a propósito: el desplegable depende de una consulta y el
    // segundo por defecto se queda corto cuando la suite corre en paralelo.
    await screen.findByRole('option', { name: /scoring/ }, { timeout: 5000 });
    fireEvent.change(screen.getByLabelText(/Variable del catálogo/), {
      target: { value: 'def-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir salida' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        variableVersionId: 'ver-9',
        code: 'scoring',
        usageType: 'OUTPUT_PRIMARY',
        dependencyPath: 'output.scoring',
      }),
    ]);
  });
});
