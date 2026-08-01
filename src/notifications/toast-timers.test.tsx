import { act, render, screen } from '@testing-library/react';
import { NotificationProvider } from './NotificationProvider';
import { ToastViewport } from './ToastViewport';
import { useNotifications } from './useNotifications';

function Raise({ label }: { label: string }) {
  const { notify } = useNotifications();
  return (
    <button type="button" onClick={() => notify({ tone: 'success', title: label })}>
      lanzar
    </button>
  );
}

function setup() {
  return render(
    <NotificationProvider>
      <Raise label="Guardado" />
      <ToastViewport />
    </NotificationProvider>,
  );
}

describe('cuentas atrás de los avisos', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('pausar dos veces (ratón y foco) no acorta el tiempo de lectura', async () => {
    setup();
    act(() => screen.getByRole('button', { name: 'lanzar' }).click());
    const viewport = screen.getByRole('list', { name: 'Notificaciones' });

    // 3 s de los 4,5 s del aviso de éxito transcurren a la vista.
    act(() => void vi.advanceTimersByTime(3000));
    // El ratón entra y, acto seguido, el foco cae dentro: dos pausas seguidas.
    act(() => viewport.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    act(() => viewport.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
    act(() => void vi.advanceTimersByTime(10_000));

    // Sigue en pantalla: mientras se lee, la cuenta atrás no corre.
    expect(screen.getByText('Guardado')).toBeInTheDocument();

    // Al salir el ratón quedaba 1,5 s de verdad, no cero.
    act(() => viewport.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText('Guardado')).toBeInTheDocument();
  });

  it('no deja temporizadores vivos tras desmontar el proveedor', () => {
    const { unmount } = setup();
    act(() => screen.getByRole('button', { name: 'lanzar' }).click());

    // Descartar arranca la animación de salida, que termina en un temporizador.
    act(() => screen.getByRole('button', { name: /Descartar/ }).click());
    unmount();

    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    act(() => void vi.advanceTimersByTime(5000));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
