import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiRequest } from '../api/http-client';
import { SimulatorPage } from './SimulatorPage';

const notify = vi.fn();

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../notifications/useNotifications', () => ({
  useNotifications: () => ({ notify }),
}));

const mockedApiRequest = vi.mocked(apiRequest);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SimulatorPage />
    </QueryClientProvider>,
  );
}

describe('SimulatorPage', () => {
  beforeEach(() => {
    notify.mockReset();
    vi.stubGlobal('crypto', { randomUUID: () => 'simulation-request-1' });
    mockedApiRequest.mockImplementation(async (path) => {
      if (path === '/v1/environments') {
        return [
          {
            id: '1',
            code: 'DEV',
            name: 'Development',
            environmentType: 'DEV',
            status: 'ACTIVE',
            isProduction: false,
          },
          {
            id: '2',
            code: 'PROD',
            name: 'Production',
            environmentType: 'PRODUCTION',
            status: 'ACTIVE',
            isProduction: true,
          },
        ] as never;
      }
      if (path === '/v1/views/pickers/artifacts') {
        return [
          { id: '1', artifactCode: 'POLICY', name: 'Policy artifact', latestVersionNumber: 1 },
        ] as never;
      }
      if (path.startsWith('/v1/views/artifact-inputs')) {
        return {
          artifactCode: 'POLICY',
          versionId: '3',
          versionNumber: 1,
          variables: [],
        } as never;
      }
      return {
        simulation: true,
        persisted: false,
        requestId: 'simulation-request-1',
        status: 'SUCCESS',
        outcome: 'APPROVED',
        output: { limit: 1500 },
        reasonCodes: [],
        artifact: {
          code: 'POLICY',
          versionId: '3',
          deploymentId: '4',
          environment: 'DEV',
          checksum: 'checksum',
        },
        trace: { nodes: ['START', 'APPROVE'], edges: ['EDGE_1'], terminal: 'APPROVE' },
        durationMs: 2,
      } as never;
    });
  });

  it('offers only non-production environments and calls the dry-run endpoint', async () => {
    renderPage();
    expect(await screen.findByRole('option', { name: /Development/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Production/ })).not.toBeInTheDocument();

    expect(
      await screen.findByRole('option', { name: /POLICY · Policy artifact/ }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Artefacto'), { target: { value: 'POLICY' } });
    fireEvent.click(screen.getByRole('button', { name: /Ejecutar/ }));

    await waitFor(() =>
      expect(mockedApiRequest).toHaveBeenCalledWith(
        '/v1/simulations/POLICY',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ environmentCode: 'DEV' }),
        }),
      ),
    );
    expect(mockedApiRequest.mock.calls.some(([path]) => path.startsWith('/v1/decisions'))).toBe(
      false,
    );
    expect(await screen.findByText('1500')).toBeInTheDocument();
  });
});
