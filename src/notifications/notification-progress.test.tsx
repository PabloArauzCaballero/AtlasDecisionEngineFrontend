import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { NotificationProvider } from './NotificationProvider';
import { useNotifications } from './useNotifications';

function wrapper({ children }: PropsWithChildren) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

function setup() {
  return renderHook(() => useNotifications(), { wrapper });
}

describe('repeticiones del mismo suceso', () => {
  it('funde el aviso repetido en una tarjeta con contador', () => {
    const { result } = setup();

    act(() => {
      result.current.notify({ tone: 'error', title: 'Sin conexión con el backend' });
      result.current.notify({ tone: 'error', title: 'Sin conexión con el backend' });
      result.current.notify({ tone: 'error', title: 'Sin conexión con el backend' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].repeatCount).toBe(3);
    // Tampoco llena el historial de copias del mismo fallo.
    expect(result.current.history).toHaveLength(1);
  });

  it('dos sucesos distintos no se funden aunque lleguen juntos', () => {
    const { result } = setup();

    act(() => {
      result.current.notify({ tone: 'error', title: 'Falló el nodo 4' });
      result.current.notify({ tone: 'error', title: 'Falló el nodo 9' });
    });

    expect(result.current.toasts).toHaveLength(2);
  });

  it('repetir repone la cuenta atrás en vez de dejarla correr', () => {
    vi.useFakeTimers();
    const { result } = setup();

    act(() => void result.current.notify({ tone: 'success', title: 'Guardado' }));
    // A 500 ms de expirar, el mismo suceso vuelve a ocurrir.
    act(() => void vi.advanceTimersByTime(4000));
    act(() => void result.current.notify({ tone: 'success', title: 'Guardado' }));

    act(() => void vi.advanceTimersByTime(4000));
    expect(result.current.toasts[0].leaving).toBe(false);

    act(() => void vi.advanceTimersByTime(500));
    expect(result.current.toasts[0].leaving).toBe(true);
    vi.useRealTimers();
  });

  it('la huella a mano funde textos distintos del mismo fallo', () => {
    const { result } = setup();

    act(() => {
      result.current.notify({ tone: 'error', title: 'Reintento 1 fallido', dedupeKey: 'deploy' });
      result.current.notify({ tone: 'error', title: 'Reintento 2 fallido', dedupeKey: 'deploy' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].repeatCount).toBe(2);
  });
});

describe('a quién se sacrifica cuando sobran avisos', () => {
  it('un fallo pegajoso sobrevive a una ráfaga de aciertos', () => {
    const { result } = setup();

    act(() => void result.current.notify({ tone: 'error', title: 'La versión no se validó' }));
    act(() => {
      // Cuatro guardados correctos seguidos: antes echaban el fallo de la pila.
      for (let index = 0; index < 4; index += 1) {
        result.current.notify({ tone: 'success', title: `Guardado ${index}` });
      }
    });

    expect(result.current.toasts).toHaveLength(4);
    expect(result.current.toasts.map((toast) => toast.title)).toContain('La versión no se validó');
  });
});

describe('operaciones en curso', () => {
  it('la misma tarjeta cuenta el avance y el desenlace', () => {
    vi.useFakeTimers();
    const { result } = setup();
    let id = '';

    act(() => {
      id = result.current.notify({ title: 'Procesando archivo', progress: null, durationMs: null });
    });
    expect(result.current.toasts[0].progress).toBeNull();

    act(() => result.current.update(id, { progress: 0.65 }));
    expect(result.current.toasts[0].progress).toBe(0.65);
    expect(result.current.toasts).toHaveLength(1);

    act(() => result.current.update(id, { tone: 'success', title: 'Archivo procesado' }));
    const [done] = result.current.toasts;
    expect(done.tone).toBe('success');
    // Al cerrarse deja de estar «en curso» y aprende a marcharse solo.
    expect(done.progress).toBeUndefined();
    expect(done.durationMs).toBe(4500);

    act(() => void vi.advanceTimersByTime(4500));
    expect(result.current.toasts[0].leaving).toBe(true);
    vi.useRealTimers();
  });

  it('retocar un aviso ya retirado no lo resucita', () => {
    const { result } = setup();
    act(() => void result.current.update('n404-0', { tone: 'success', title: 'Fantasma' }));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('promise() no canta victoria hasta que el backend responde', async () => {
    const { result } = setup();
    let settle: (value: string) => void = () => undefined;
    const work = new Promise<string>((resolve) => {
      settle = resolve;
    });

    let outcome: Promise<string> | undefined;
    act(() => {
      outcome = result.current.promise(work, {
        loading: 'Guardando cambios…',
        success: (saved) => `Guardado ${saved}`,
      });
    });

    // Mientras corre no hay más que la tarjeta de espera, y no dice «guardado».
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Guardando cambios…');
    expect(result.current.toasts[0].progress).toBeNull();

    await act(async () => {
      settle('v12');
      await outcome;
    });

    expect(result.current.toasts[0].title).toBe('Guardado v12');
    expect(result.current.toasts[0].tone).toBe('success');
  });

  it('sin texto de error retira su tarjeta: el fallo lo cuenta el aviso global', async () => {
    const { result } = setup();
    const failure = Promise.reject(new Error('409'));

    await act(async () => {
      await expect(
        result.current.promise(failure, { loading: 'Publicando…', success: 'Publicado' }),
      ).rejects.toThrow('409');
    });

    // Se marcha sola; no deja un segundo mensaje del mismo fallo.
    await waitFor(() => expect(result.current.toasts[0].leaving).toBe(true));
    expect(result.current.toasts.some((toast) => toast.tone === 'error')).toBe(false);
  });
});
