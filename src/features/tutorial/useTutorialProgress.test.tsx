import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../api/http-client', () => ({ apiRequest }));

const { useTutorialProgress } = await import('./useTutorialProgress');

beforeEach(() => {
  apiRequest.mockReset();
  window.localStorage.clear();
});

describe('useTutorialProgress', () => {
  it('carga el progreso desde el backend y lo deja en caché', async () => {
    apiRequest.mockResolvedValueOnce([
      {
        tutorialId: 'artifacts:versions',
        status: 'COMPLETED',
        lastStep: 3,
        version: 1,
        autoShow: true,
      },
    ]);

    const { result } = renderHook(() => useTutorialProgress());

    await waitFor(() => expect(result.current.isCompleted('artifacts:versions')).toBe(true));
    expect(localStorage.getItem('atlas.tutorial.progress')).toContain('artifacts:versions');
  });

  it('marcar completado hace PUT y actualiza el estado local', async () => {
    apiRequest.mockResolvedValueOnce([]); // carga inicial
    const { result } = renderHook(() => useTutorialProgress());
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));

    apiRequest.mockResolvedValueOnce({}); // respuesta del PUT
    await act(async () => {
      await result.current.markCompleted('graph-editor:design');
    });

    expect(result.current.isCompleted('graph-editor:design')).toBe(true);
    const putCall = apiRequest.mock.calls.find((call) =>
      String(call[0]).includes('graph-editor%3Adesign'),
    );
    expect(putCall?.[1]).toMatchObject({ method: 'PUT' });
  });

  it('si el backend falla al cargar, conserva la caché local', async () => {
    window.localStorage.setItem(
      'atlas.tutorial.progress',
      JSON.stringify({
        x: { tutorialId: 'x', status: 'SKIPPED', lastStep: 0, version: 1, autoShow: true },
      }),
    );
    apiRequest.mockRejectedValueOnce(new Error('backend caído'));

    const { result } = renderHook(() => useTutorialProgress());

    await waitFor(() => expect(result.current.isSkipped('x')).toBe(true));
  });
});
