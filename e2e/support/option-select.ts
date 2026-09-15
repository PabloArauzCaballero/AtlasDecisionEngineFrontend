import type { Locator } from '@playwright/test';

/**
 * Manejar un `OptionSelect` desde un E2E, como lo haría una persona.
 *
 * `selectOption` sólo sirve para un `<select>` nativo. El desplegable del portal es un botón
 * `combobox` y una lista en un portal del `body`: se abre el botón y se pulsa la fila cuyo
 * `data-testid` acaba en `-option-<valor>`. Localizar la fila por valor, y no por su texto,
 * sobrevive a que la etiqueta lleve además la descripción de la opción.
 */
export async function elegirOpcion(control: Locator, valor: string): Promise<void> {
  await control.click();
  await control.page().locator(`[role="option"][data-testid$="-option-${valor}"]`).first().click();
}

/** El valor elegido de un `OptionSelect` (`data-value`). */
export function valorDe(control: Locator): Promise<string | null> {
  return control.getAttribute('data-value');
}
