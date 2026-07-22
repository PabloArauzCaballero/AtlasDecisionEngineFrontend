import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useGraphEditor } from './useGraphEditor';

vi.mock('../../api/http-client', () => ({
  apiRequest: vi.fn((path: string) => {
    if (path.endsWith('/graph')) {
      return Promise.resolve({
        nodes: [{ key: 'START', type: 'START' }],
        edges: [],
        variables: [],
        conditions: [],
      });
    }
    return Promise.resolve({ lockVersion: 3 });
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useGraphEditor (Fase 3 QA — loading/sync fix)', () => {
  // The auto-load-on-mount is wired in GraphEditorPage; the hook exposes a load
  // mutation that accepts an explicit target id so that effect never races the
  // versionId state. This verifies that load-with-explicit-id path.
  it('loads the graph for an explicitly-provided version id', async () => {
    const { result } = renderHook(() => useGraphEditor(''), { wrapper });

    act(() => result.current.load.mutate('42'));
    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect(result.current.load.isSuccess).toBe(true);
  });

  it('is idle and empty before any load is triggered', () => {
    const { result } = renderHook(() => useGraphEditor(''), { wrapper });
    expect(result.current.load.isIdle).toBe(true);
    expect(result.current.nodes).toEqual([]);
  });
});
