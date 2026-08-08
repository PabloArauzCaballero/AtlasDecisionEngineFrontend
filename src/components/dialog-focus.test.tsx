import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { ModalDialog } from './ModalDialog';
import { useDialogFocus } from '../hooks/useDialogFocus';

function Host() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <button type="button">Detrás</button>
      {open ? (
        <ModalDialog
          title="Confirmar"
          onClose={() => setOpen(false)}
          actions={
            <button type="button" onClick={() => setOpen(false)}>
              Aceptar
            </button>
          }
        >
          <input aria-label="Motivo" />
        </ModalDialog>
      ) : null}
    </>
  );
}

/** Controles del diálogo, en el orden en que los recorre el tabulador. */
function focusablesOf(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>('button, input')];
}

describe('foco de los diálogos modales', () => {
  it('lleva el foco dentro al abrir', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    // El primer control del diálogo es el de cerrar.
    expect(document.activeElement).toBe(focusablesOf(dialog)[0]);
  });

  it('el tabulador da la vuelta en el último control en vez de escaparse', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog');
    const controls = focusablesOf(dialog);
    const first = controls[0]!;
    const last = controls[controls.length - 1]!;

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    // Sin trampa, el siguiente en recibir el foco sería «Detrás»: justo lo que
    // `aria-modal="true"` promete que está inerte.
    expect(document.activeElement).toBe(first);
  });

  it('retrocede al último control al tabular hacia atrás desde el primero', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog');
    const controls = focusablesOf(dialog);
    const first = controls[0]!;

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(controls[controls.length - 1]);
  });

  it('recupera el foco si se había escapado fuera del diálogo', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog');
    const outside = screen.getByRole('button', { name: 'Detrás' });

    outside.focus();
    fireEvent.keyDown(outside, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('devuelve el foco a quien lo abrió al cerrarse', () => {
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    // El navegador enfoca el botón al pulsarlo; `fireEvent.click` no lo hace,
    // así que se reproduce a mano para partir del estado real.
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    // Sin esto, quien navega con teclado vuelve al principio del documento y
    // pierde el sitio donde estaba trabajando.
    expect(document.activeElement).toBe(opener);
  });

  /**
   * Un diálogo que usa el hook DIRECTAMENTE, sin pasar por `ModalDialog`.
   *
   * Es la forma que tenían el alta de despliegue y algún otro, y la que se
   * quedaba sin salida por teclado: `ModalDialog` resolvía Escape por su cuenta,
   * así que el agujero sólo aparecía fuera de él. Se detectó barriendo el portal
   * con teclado, no leyendo el código.
   */
  it('Escape cierra un diálogo que usa el hook sin pasar por ModalDialog', () => {
    function HostDirecto() {
      const [open, setOpen] = useState(true);
      const dialog = useRef<HTMLElement>(null);
      useDialogFocus(dialog, undefined, () => setOpen(false));
      if (!open) return <p>cerrado</p>;
      return (
        <section ref={dialog as never} role="dialog" aria-modal="true" aria-label="Directo">
          <button type="button">Algo</button>
        </section>
      );
    }

    render(<HostDirecto />);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('cerrado')).toBeTruthy();
  });

  /**
   * Sin `onClose`, Escape no hace nada.
   *
   * Es deliberado: un panel que no se puede cerrar no debe fingir que sí, y
   * cerrar por omisión rompería a quien use el hook para algo que no es
   * descartable.
   */
  it('sin onClose, Escape no cierra nada', () => {
    function HostSinCierre() {
      const dialog = useRef<HTMLElement>(null);
      useDialogFocus(dialog);
      return (
        <section ref={dialog as never} role="dialog" aria-modal="true" aria-label="Fijo">
          <button type="button">Algo</button>
        </section>
      );
    }

    render(<HostSinCierre />);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
