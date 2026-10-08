import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { apiRequest } from '../api/http-client';
import { newestFirst, usePickerDefault } from './usePickerDefault';

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));

const mockedApiRequest = vi.mocked(apiRequest);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const SUITES = [
  { id: '7', artifactVersionId: '40' },
  { id: '12', artifactVersionId: '41' },
  { id: '9', artifactVersionId: '40' },
];

describe('usePickerDefault: las pantallas abren con datos', () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it('propone la fila más reciente (id más alto) y lee el campo pedido', async () => {
    mockedApiRequest.mockResolvedValue(SUITES);
    const { result } = renderHook(
      () =>
        usePickerDefault({
          endpoint: '/v1/views/pickers/test-suites',
          queryKey: 'test-suites',
          enabled: true,
          valueKey: 'artifactVersionId',
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBe('41'));
  });

  it('acepta el sobre paginado `{ items }`', async () => {
    mockedApiRequest.mockResolvedValue({ items: SUITES });
    const { result } = renderHook(
      () => usePickerDefault({ endpoint: '/x', queryKey: 'x', enabled: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBe('12'));
  });

  it('respeta un orden propio (p. ej. primero lo desplegado)', async () => {
    mockedApiRequest.mockResolvedValue([
      { id: '50', status: 'DRAFT' },
      { id: '44', status: 'DEPLOYED_TO_TEST' },
    ]);
    const deployedFirst = (a: Record<string, unknown>, b: Record<string, unknown>) =>
      Number(String(b.status).startsWith('DEPLOYED')) -
        Number(String(a.status).startsWith('DEPLOYED')) || newestFirst(a, b);
    const { result } = renderHook(
      () => usePickerDefault({ endpoint: '/y', queryKey: 'y', enabled: true, rank: deployedFirst }),
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBe('44'));
  });

  it('desactivado (ya hay una elección o un enlace directo) no pide nada ni propone nada', () => {
    const { result } = renderHook(
      () => usePickerDefault({ endpoint: '/z', queryKey: 'z', enabled: false }),
      { wrapper },
    );
    expect(result.current).toBe('');
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('con la lista vacía no inventa nada', async () => {
    mockedApiRequest.mockResolvedValue([]);
    const { result } = renderHook(
      () => usePickerDefault({ endpoint: '/w', queryKey: 'w', enabled: true }),
      { wrapper },
    );
    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalled());
    expect(result.current).toBe('');
  });
});
