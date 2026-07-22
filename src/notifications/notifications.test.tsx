import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { NotificationProvider } from './NotificationProvider';
import { useNotifications } from './useNotifications';

function wrapper({ children }: PropsWithChildren) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

function setup() {
  return renderHook(() => useNotifications(), { wrapper });
}

/** Mirrors the exit animation the provider waits on before unmounting a toast. */
const EXIT_MS = 180;

describe('notification provider', () => {
  afterEach(() => vi.useRealTimers());

  it('retires a success toast once its countdown elapses', () => {
    vi.useFakeTimers();
    const { result } = setup();

    act(() => {
      result.current.notify({ tone: 'success', title: 'Compilación completada' });
    });
    expect(result.current.toasts).toHaveLength(1);

    // The default success countdown expires and hands over to the exit phase.
    act(() => void vi.advanceTimersByTime(4500));
    expect(result.current.toasts[0].leaving).toBe(true);

    act(() => void vi.advanceTimersByTime(EXIT_MS));
    expect(result.current.toasts).toHaveLength(0);
    // Dismissed toasts stay readable in the bell menu.
    expect(result.current.history).toHaveLength(1);
  });

  it('keeps failures on screen until dismissed by hand', () => {
    vi.useFakeTimers();
    const { result } = setup();

    act(() => {
      result.current.notify({ tone: 'error', title: 'Sin conexión con el backend' });
    });
    act(() => void vi.advanceTimersByTime(60_000));
    expect(result.current.toasts).toHaveLength(1);

    act(() => result.current.dismiss(result.current.toasts[0].id));
    act(() => void vi.advanceTimersByTime(EXIT_MS));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('freezes countdowns while the stack is hovered and resumes the remainder', () => {
    vi.useFakeTimers();
    const { result } = setup();

    act(() => {
      result.current.notify({ tone: 'info', title: 'Suites encoladas', durationMs: 1000 });
    });
    act(() => void vi.advanceTimersByTime(600));
    act(() => result.current.pauseTimers());

    // Time passing while paused must not consume the toast's remaining 400ms.
    act(() => void vi.advanceTimersByTime(30_000));
    expect(result.current.paused).toBe(true);
    expect(result.current.toasts[0].leaving).toBe(false);

    act(() => result.current.resumeTimers());
    act(() => void vi.advanceTimersByTime(399));
    expect(result.current.toasts[0].leaving).toBe(false);

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.toasts[0].leaving).toBe(true);
  });

  it('caps the visible stack but records every notification', () => {
    const { result } = setup();

    act(() => {
      for (let index = 0; index < 6; index += 1) {
        result.current.notify({ tone: 'error', title: `Fallo ${index}` });
      }
    });

    expect(result.current.toasts).toHaveLength(4);
    // The oldest two retire early; the newest four remain, oldest-first.
    expect(result.current.toasts[0].title).toBe('Fallo 2');
    expect(result.current.history).toHaveLength(6);
    expect(result.current.history[0].title).toBe('Fallo 5');
  });

  it('tracks unread entries until the operator acknowledges them', () => {
    const { result } = setup();

    act(() => {
      result.current.notify({ tone: 'success', title: 'Versión enviada' });
      result.current.notify({ tone: 'warning', title: 'Permiso denegado' });
    });
    expect(result.current.unreadCount).toBe(2);

    act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);

    act(() => result.current.clearHistory());
    expect(result.current.history).toHaveLength(0);
  });
});
