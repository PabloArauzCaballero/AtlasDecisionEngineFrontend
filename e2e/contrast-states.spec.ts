import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './support/backend-mock';
import {
  AA_FLOOR,
  SAMPLE_ROUTES,
  SWEEP_TIMEOUT_MS,
  describeOffenders,
  lowContrastNodes,
  withPseudoState,
  type Offender,
  type Pseudo,
} from './support/contrast-probe';

/**
 * Contraste de los estados de puntero y teclado.
 *
 * `contrast.spec.ts` mide lo que se ve en reposo. Aquí se mide lo que aparece al
 * pasar el ratón o al tabular, que es donde las hojas cambian color y fondo a la
 * vez y donde nadie había mirado nunca: un `:hover` que aclara el fondo sin tocar
 * la letra pasa desapercibido al escribirlo y deja el texto flotando.
 *
 * `:focus-visible` es el más importante de los dos. Quien navega con teclado no
 * tiene ninguna otra pista de dónde está; si el anillo o el texto enfocado no se
 * distinguen, la aplicación deja de poder usarse sin ratón.
 */

/** Suelo de elementos forzados por ruta: cero delataría que no se midió nada. */
const MIN_FORCED = 5;

/**
 * Combinaciones a medir.
 *
 * Las dos por separado y las dos juntas. La combinación no es redundante: es lo
 * que ve quien tabula hasta un botón y además deja el ratón encima, y muchas
 * hojas escriben `:hover` y `:focus-visible` con colores distintos sin pensar en
 * qué pasa cuando ganan los dos a la vez.
 *
 * Los estados que vienen de una clase —el enlace activo del menú, la pestaña
 * seleccionada, una insignia de error— entran solos: ya están en el DOM al
 * cargar, así que forzar `:hover` sobre ellos mide justamente la mezcla.
 */
const COMBINATIONS: readonly (readonly Pseudo[])[] = [
  ['hover'],
  ['focus-visible'],
  ['hover', 'focus-visible'],
];

const nameOf = (pseudo: readonly Pseudo[]) => pseudo.map((p) => `:${p}`).join(' + ');

async function measure(page: Page, theme: 'dark' | 'light', pseudo: readonly Pseudo[]) {
  test.setTimeout(SWEEP_TIMEOUT_MS);
  await mockBackend(page);
  await page.addInitScript((value) => window.localStorage.setItem('atlas.theme', value), theme);

  const offenders: (Offender & { route: string })[] = [];
  const empty: string[] = [];
  for (const route of SAMPLE_ROUTES) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('#main-content')).toContainText(/\S/, { timeout: 60_000 });
    await page.waitForTimeout(400);

    const found = await withPseudoState(page, pseudo, async (forced) => {
      if (forced < MIN_FORCED) empty.push(`${route} (${forced})`);
      // Un respiro para que el navegador vuelva a calcular estilos.
      await page.waitForTimeout(250);
      return (await lowContrastNodes(page, AA_FLOOR)).offenders;
    });
    for (const offender of found) offenders.push({ ...offender, route });
  }

  expect(empty, `Rutas sin elementos interactivos que forzar: ${empty.join(', ')}`).toEqual([]);
  expect(
    offenders,
    `Texto por debajo de ${AA_FLOOR}:1 con ${nameOf(pseudo)} en tema ${theme}:\n` +
      describeOffenders(offenders),
  ).toEqual([]);
}

for (const theme of ['dark', 'light'] as const) {
  const label = theme === 'dark' ? 'oscuro' : 'claro';
  for (const pseudo of COMBINATIONS) {
    test(`ningún texto queda ilegible con ${nameOf(pseudo)} en tema ${label}`, async ({ page }) => {
      await measure(page, theme, pseudo);
    });
  }
}
