import { fireEvent, screen, waitFor } from '@testing-library/react';

/**
 * Manejar un `OptionSelect` desde una prueba, como lo haría una persona.
 *
 * Con el `<select>` nativo las pruebas hacían `fireEvent.change(select, …)`. El
 * desplegable propio es un botón `combobox` y una lista en un portal: sólo
 * existen filas `role="option"` mientras está abierto, así que se abre, se
 * pulsa la fila y se deja cerrado — el mismo recorrido que el E2E.
 */

/** El control de un campo por su etiqueta, sea un input o un `OptionSelect`. */
export const campo = (label: string | RegExp) =>
  screen.getByLabelText(label, { selector: 'input, textarea, [role="combobox"]' });

/** Las filas visibles de un `OptionSelect`, abriéndolo si hace falta. */
export function abrirOpciones(control: HTMLElement): HTMLElement[] {
  if (control.getAttribute('aria-expanded') !== 'true') fireEvent.click(control);
  return screen.queryAllByRole('option');
}

/** Cierra la lista sin elegir (Escape, como el teclado). */
export function cerrarOpciones(control: HTMLElement) {
  if (control.getAttribute('aria-expanded') === 'true') {
    fireEvent.keyDown(control, { key: 'Escape' });
  }
}

/** Elige por VALOR: abre la lista y pulsa la fila `…-option-<valor>`. */
export function elegirOpcion(control: HTMLElement, value: string) {
  const filas = abrirOpciones(control);
  const fila = filas.find((row) => row.getAttribute('data-testid')?.endsWith(`-option-${value}`));
  if (!fila) {
    const hay = filas.map((row) => row.getAttribute('data-testid')).join(', ');
    throw new Error(`No hay opción «${value}» en el desplegable. Hay: ${hay || 'ninguna'}`);
  }
  fireEvent.click(fila);
}

/**
 * Abre el desplegable en cuanto se pueda y espera a que `comprobar` pase.
 *
 * El clic sólo ocurre UNA vez: `waitFor` vuelve a llamar a su función en cada mutación del DOM, y
 * una función que abre y cierra la lista en cada intento se realimenta sin fin mientras el catálogo
 * no llega —el temporizador que la cortaría nunca llega a correr y la prueba se cuelga—.
 */
export async function abrirYEsperar(control: () => HTMLElement, comprobar: () => void) {
  await waitFor(() => {
    const boton = control();
    if (boton.getAttribute('aria-expanded') !== 'true' && !(boton as HTMLButtonElement).disabled) {
      fireEvent.click(boton);
    }
    comprobar();
  });
}

/** Espera a que el desplegable ofrezca una opción con ese valor (catálogo asíncrono). */
export async function esperarOpcion(control: () => HTMLElement, value: string) {
  await abrirYEsperar(control, () => {
    const hay = screen
      .queryAllByRole('option')
      .some((row) => row.getAttribute('data-testid')?.endsWith(`-option-${value}`));
    if (!hay) throw new Error(`Todavía no hay opción «${value}»`);
  });
  cerrarOpciones(control());
}

/** El valor de un control, sea un input nativo o un `OptionSelect` (`data-value`). */
export function valorDe(control: HTMLElement): string {
  if (control.getAttribute('role') === 'combobox') return control.getAttribute('data-value') ?? '';
  return (control as HTMLInputElement).value;
}

/** Pone un valor como lo haría la persona: escribe en un input o elige en un desplegable. */
export function rellenar(control: HTMLElement, value: string) {
  if (control.getAttribute('role') === 'combobox') elegirOpcion(control, value);
  else fireEvent.change(control, { target: { value } });
}
