import { expect, test } from '@playwright/test';
import { collectProblems, mockBackend } from './support/backend-mock';

/**
 * Tema oscuro y fondos ambientales por familia de rutas.
 *
 * Comprueban lo que sólo se ve en un navegador real: que el tema se resuelve
 * antes del primer pintado, que el contraste aguanta sobre las superficies
 * oscuras y que cada zona de la plataforma trae el fondo que le corresponde.
 */

test('el tema oscuro se activa, se recuerda y no produce destello al recargar', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = collectProblems(page);
  await mockBackend(page);

  await page.goto('/platform-health', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.dash-grid')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // sistema → claro → oscuro
  const toggle = page.getByRole('button', { name: /Cambiar tema/ });
  await toggle.click();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // El lienzo pasa a ser oscuro de verdad. Se comprueba el brillo en lugar de
  // un color exacto: el token puede afinarse sin invalidar la prueba, y lo que
  // importa es que el fondo deje de ser claro.
  // Se consulta con `poll` porque el cambio de tema anima el color durante unos
  // milisegundos: medirlo al instante devolvería el valor de partida.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const [r, g, b] = (
          getComputedStyle(document.body).backgroundColor.match(/\d+/g) ?? ['255', '255', '255']
        ).map(Number);
        return (r + g + b) / 3;
      }),
    )
    .toBeLessThan(40);

  // Al recargar, el tema debe llegar del script de arranque —que es en línea y
  // bloquea el parseo—, no de un efecto de React: de lo contrario se vería un
  // destello blanco a pantalla completa. Aquí se comprueba el resultado; que el
  // script lo resuelva por sí solo lo cubre `src/theme/theme.test.tsx`.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 30_000 });

  expect(problems, problems.join('\n')).toEqual([]);
});

test('el tema oscuro mantiene legible el texto sobre las superficies', async ({ page }) => {
  test.setTimeout(120_000);
  await mockBackend(page);
  await page.goto('/platform-health', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.dash-grid')).toBeVisible({ timeout: 30_000 });

  const toggle = page.getByRole('button', { name: /Cambiar tema/ });
  await toggle.click();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Contraste real del número de una tarjeta contra su propio fondo. Se mide con
  // `poll` porque el cambio de tema anima el color durante unos milisegundos:
  // una espera fija se queda corta en cuanto la máquina va cargada.
  // 4.5:1 es el mínimo de la WCAG AA para texto normal.
  await expect
    .poll(
      () =>
        page
          .locator('.dash-card > strong')
          .first()
          .evaluate((element) => {
            const luminance = (color: string) => {
              const [r, g, b] = (color.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).map(Number);
              const channel = (value: number) => {
                const scaled = value / 255;
                return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
              };
              return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
            };
            const card = element.closest('.dash-card') as HTMLElement;
            const a = luminance(getComputedStyle(element).color);
            const b = luminance(getComputedStyle(card).backgroundColor);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          }),
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(4.5);
});

test('cada familia de rutas trae su propio fondo ambiental', async ({ page }) => {
  test.setTimeout(180_000);
  await mockBackend(page);

  const expected: Array<[string, string]> = [
    ['/platform-health', 'ambient-dashboard'],
    ['/graph-editor', 'ambient-editor'],
    ['/test-suites', 'ambient-lab'],
    ['/deployments', 'ambient-deploy'],
    ['/executions', 'ambient-results'],
  ];

  for (const [route, variant] of expected) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const background = page.locator('.app-shell > .ambient-bg');
    await expect(background).toHaveClass(new RegExp(variant), { timeout: 30_000 });
    // Un único fondo en toda la aplicación, no uno por página.
    await expect(page.locator('.ambient-bg')).toHaveCount(1);
  }
});
