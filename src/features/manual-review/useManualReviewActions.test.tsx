import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { apiRequest } from '../../api/http-client';
import { RESOLUTION_LABEL, RESOLUTION_OPTIONS } from './resolution-options';
import { useManualReviewActions } from './useManualReviewActions';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));

const mockedApiRequest = vi.mocked(apiRequest);
const ACEPTADOS_POR_EL_MOTOR = ['APPROVE', 'DECLINE', 'CANCEL'];

function montar(resolution: string) {
  const notify = vi.fn();
  const onResolved = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () =>
      useManualReviewActions({
        caseId: '12',
        review: { id: '12' },
        resolution,
        comments: 'Revisé la evidencia.',
        notify,
        startForError: vi.fn(),
        refetch: vi.fn(),
        onResolved,
        resolutionLabel: RESOLUTION_LABEL,
      }),
    { wrapper },
  );
  return { ...view, notify, onResolved };
}

describe('useManualReviewActions · resolver', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    mockedApiRequest.mockResolvedValue({});
  });

  it.each(RESOLUTION_OPTIONS.map((opcion) => [opcion.label, opcion.value]))(
    '«%s» manda al motor un valor que acepta (%s)',
    async (_rotulo, valor) => {
      const { result, onResolved } = montar(valor);
      await act(async () => {
        await result.current.resolve.mutateAsync();
      });

      const [ruta, opciones] = mockedApiRequest.mock.calls[0] ?? [];
      expect(ruta).toBe('/v1/manual-reviews/12/resolve');
      const cuerpo = (opciones as { body: { decision: string; reason: string } }).body;
      expect(ACEPTADOS_POR_EL_MOTOR).toContain(cuerpo.decision);
      expect(cuerpo).toEqual({ decision: valor, reason: 'Revisé la evidencia.' });
      expect(onResolved).toHaveBeenCalledWith(valor);
    },
  );

  it.each(['REJECT', 'ESCALATE', ''])(
    'no manda «%s»: el motor lo rechazaría con un 400, así que ni sale de la pantalla',
    async (valor) => {
      const { result, onResolved } = montar(valor);
      await act(async () => {
        await result.current.resolve.mutateAsync().catch(() => undefined);
      });

      expect(mockedApiRequest).not.toHaveBeenCalled();
      expect(onResolved).not.toHaveBeenCalled();
      await waitFor(() => expect(result.current.resolve.error).toBeInstanceOf(Error));
    },
  );

  it('al cancelar el aviso dice que no se decidió nada', async () => {
    const { result, notify } = montar('CANCEL');
    await act(async () => {
      await result.current.resolve.mutateAsync();
    });

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Caso cancelado',
        description: expect.stringContaining('sin decidir'),
      }),
    );
  });
});
