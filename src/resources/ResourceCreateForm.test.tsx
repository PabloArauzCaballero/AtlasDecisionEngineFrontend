import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiRequest } from '../api/http-client';
import { ResourceCreateForm } from './ResourceCreateForm';
import type { ResourceConfig } from './resource.types';

const notify = vi.fn();

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../notifications/useNotifications', () => ({ useNotifications: () => ({ notify }) }));

const mockedApiRequest = vi.mocked(apiRequest);

const config: ResourceConfig = {
  key: 'widgets',
  eyebrow: '',
  title: 'Widgets',
  description: '',
  endpoint: '/v1/widgets',
  columns: [],
  primaryAction: 'Crear widget',
  createFields: [
    { key: 'code', label: 'Código', required: true, code: true },
    { key: 'kind', label: 'Tipo', required: true, optionsEndpoint: '/v1/views/options?group=k' },
    { key: 'initialVersion.dataType', label: 'Dato', required: true },
    { key: 'flags.active', label: 'Activo', kind: 'checkbox', defaultValue: true },
  ],
  createStaticBody: { flags: { audited: true } },
};

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ResourceCreateForm config={config} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('ResourceCreateForm', () => {
  beforeEach(() => {
    notify.mockReset();
    mockedApiRequest.mockReset();
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path.startsWith('/v1/views/options')) {
        return [{ value: 'EXISTING', label: 'EXISTING' }] as never;
      }
      return {} as never;
    });
  });

  it('normalizes codes, allows a new catalog value, nests dotted keys and merges the static body', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'w-1' } });
    // A value that is NOT in the catalog must still be accepted (inline create).
    fireEvent.change(screen.getByLabelText(/Tipo/), { target: { value: 'BRAND_NEW' } });
    fireEvent.change(screen.getByLabelText('Dato'), { target: { value: 'STRING' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear widget/ }));

    await waitFor(() =>
      expect(mockedApiRequest).toHaveBeenCalledWith('/v1/widgets', {
        method: 'POST',
        body: {
          flags: { audited: true, active: true },
          code: 'W-1',
          kind: 'BRAND_NEW',
          initialVersion: { dataType: 'STRING' },
        },
      }),
    );
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));
  });
});
