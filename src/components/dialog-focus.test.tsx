import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ModalDialog } from './ModalDialog';

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
});
