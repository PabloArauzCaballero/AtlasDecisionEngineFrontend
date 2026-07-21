import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useGraphEditor } from './useGraphEditor';

vi.mock('../../api/http-client', () => ({
  apiRequest: vi.fn((path: string) => {
    if (path.endsWith('/graph')) {
      return Promise.resolve({ nodes: [{ key: 'START', type: 'START' }], edges: [], variables: [], conditions: [] });
    }
    return Promise.resolve({ lockVersion: 3 });
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useGraphEditor (Fase 3 QA — loading/sync fix)', () => {
  it('auto-loads the graph when mounted with an initial version id from the route', async () => {
    const { result } = renderHook(() => useGraphEditor('42'), { wrapper });

    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect(result.current.versionId).toBe('42');
    expect(result.current.load.isSuccess).toBe(true);
  });

  it('does not auto-load when mounted without a version id', () => {
    const { result } = renderHook(() => useGraphEditor(''), { wrapper });
    expect(result.current.load.isIdle).toBe(true);
    expect(result.current.nodes).toEqual([]);
  });
});
