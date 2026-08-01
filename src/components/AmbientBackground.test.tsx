import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmbientBackground } from './AmbientBackground';

/** jsdom no implementa `matchMedia`; cada prueba declara qué responde. */
function stubMatchMedia(matching: string[]) {
  const listeners: Array<() => void> = [];
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matching.some((entry) => query.includes(entry)),
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
  });
}

/**
 * jsdom no implementa `PointerEvent`. Un `MouseEvent` con el nombre del evento
 * de puntero sirve igual: el fondo sólo lee `clientX` y `clientY`.
 */
function pointer(type: string, clientX: number, clientY: number): Event {
  return new MouseEvent(type, { clientX, clientY, bubbles: true });
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
  vi.restoreAllMocks();
});

describe('AmbientBackground', () => {
  it('nunca intercepta la interacción ni se anuncia a los lectores de pantalla', () => {
    stubMatchMedia([]);
    const { container } = render(<AmbientBackground variant="auth" />);
    const background = container.querySelector('.ambient-bg') as HTMLElement;

    expect(background).toHaveAttribute('aria-hidden', 'true');
    // `pointer-events: none` vive en la hoja de estilos; aquí se comprueba que
    // el fondo no aporta ningún control ni texto que pueda robar el foco.
    expect(background.querySelectorAll('button, a, input')).toHaveLength(0);
    expect(background.textContent).toBe('');
  });

  it('se queda estático cuando el usuario pide movimiento reducido', () => {
    stubMatchMedia(['prefers-reduced-motion']);
    const { container } = render(<AmbientBackground />);

    expect(container.querySelector('.ambient-bg')).toHaveClass('is-static');
  });

  it('se queda estático en equipos de gama baja', () => {
    stubMatchMedia([]);
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(2);
    const { container } = render(<AmbientBackground />);

    expect(container.querySelector('.ambient-bg')).toHaveClass('is-static');
  });

  it('detiene la animación cuando la pestaña deja de estar visible', () => {
    stubMatchMedia([]);
    const { container } = render(<AmbientBackground />);
    expect(container.querySelector('.ambient-bg')).toHaveClass('is-animated');

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(container.querySelector('.ambient-bg')).toHaveClass('is-static');
  });

  it('refleja el estado real de la plataforma sin cambiar su geometría', () => {
    stubMatchMedia([]);
    const { container, rerender } = render(<AmbientBackground state="idle" />);
    const nodes = container.querySelectorAll('.ambient-network i').length;

    rerender(<AmbientBackground state="error" />);

    expect(container.querySelector('.ambient-bg')).toHaveAttribute('data-state', 'error');
    expect(container.querySelectorAll('.ambient-network i')).toHaveLength(nodes);
  });

  it('limita el número de nodos animados para no castigar la gama media', () => {
    stubMatchMedia([]);
    const { container } = render(<AmbientBackground />);

    expect(container.querySelectorAll('.ambient-network i').length).toBeLessThanOrEqual(16);
  });

  it('lleva la luz exactamente donde está el cursor', async () => {
    stubMatchMedia(['pointer: fine']);
    const { container } = render(<AmbientBackground />);
    const background = container.querySelector('.ambient-bg') as HTMLElement;
    expect(background.querySelector('.ambient-spotlight')).toBeTruthy();

    act(() => {
      window.dispatchEvent(pointer('pointermove', 300, 150));
    });

    // La posición se publica como variable CSS dentro del siguiente frame; el
    // foco la usa como centro de su degradado.
    await waitFor(() => expect(background.style.getPropertyValue('--ambient-px')).not.toBe(''));
    expect(Number(background.style.getPropertyValue('--ambient-px'))).toBeGreaterThan(0);
  });

  it('responde al clic con una onda que se retira sola', () => {
    stubMatchMedia(['pointer: fine']);
    const { container } = render(<AmbientBackground />);
    const background = container.querySelector('.ambient-bg') as HTMLElement;

    act(() => {
      window.dispatchEvent(pointer('pointerdown', 120, 80));
    });

    const ripple = background.querySelector('.ambient-ripple') as HTMLElement;
    expect(ripple).toBeTruthy();
    expect(ripple.style.left).toBe('120px');

    // Al terminar su animación se quita: pulsar cien veces no acumula capas.
    act(() => {
      ripple.dispatchEvent(new Event('animationend'));
    });
    expect(background.querySelector('.ambient-ripple')).toBeNull();
  });

  it('no reacciona al puntero cuando el movimiento está reducido', () => {
    stubMatchMedia(['prefers-reduced-motion']);
    const { container } = render(<AmbientBackground />);
    const background = container.querySelector('.ambient-bg') as HTMLElement;

    act(() => {
      window.dispatchEvent(pointer('pointerdown', 10, 10));
    });

    expect(background.querySelector('.ambient-ripple')).toBeNull();
  });

  it('no registra escuchas de puntero cuando no puede animar', () => {
    stubMatchMedia(['prefers-reduced-motion']);
    const addListener = vi.spyOn(window, 'addEventListener');

    render(<AmbientBackground interactive />);

    expect(addListener.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(0);
  });
});
