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

  /*
   * El motor valida con lista blanca (`UpsertTutorialProgressDto`): un campo de
   * más no se ignora, devuelve 400. Y como el guardado se envuelve en un `catch`
   * para sobrevivir a una caída del backend, ese 400 no se veía por ninguna
   * parte: el portal mandaba `startedAt`, `completedAt`, `lastInteractionAt` y
   * `repeatCount` —contabilidad suya, que el motor no modela—, cada PUT se
   * rechazaba y el progreso vivía sólo en `localStorage`.
   *
   * La prueba que había comprobaba `{ method: 'PUT' }`, que seguía en verde con
   * el cuerpo entero mal. Por eso ésta mira las CLAVES EXACTAS: de más rompe el
   * guardado, de menos pierde un dato que el motor sí guarda.
   */
  it('el PUT manda exactamente los campos que el motor acepta', async () => {
    apiRequest.mockResolvedValueOnce([]); // carga inicial
    const { result } = renderHook(() => useTutorialProgress());
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));

    apiRequest.mockResolvedValueOnce({});
    await act(async () => {
      await result.current.markCompleted('graph-editor:design');
    });

    const putCall = apiRequest.mock.calls.find((call) =>
      String(call[0]).includes('graph-editor%3Adesign'),
    );
    const body = (putCall?.[1] as { body: Record<string, unknown> }).body;
    expect(Object.keys(body).sort()).toEqual(['autoShow', 'lastStep', 'status', 'version']);
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
