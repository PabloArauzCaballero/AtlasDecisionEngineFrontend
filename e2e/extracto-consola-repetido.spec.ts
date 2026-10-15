import { expect, test, type Page } from '@playwright/test';
import { mockStatementTriage } from './support/statement-triage-backend';

/**
 * La consola de extractos no se queda en blanco con un PDF que el motor ya tenía.
 *
 * Pablo (2026-10-15): «no está dando la consola con uno que le subo». El motor deduplica por la
 * huella del archivo y devolvía la ejecución anterior —detenida porque no reconoció la entidad, o
 * cerrada sin movimientos— mientras la consola anunciaba «Extracto encolado» y debajo no aparecía
 * nada. Aquí se exige que lo diga y que diga adónde ir.
 *
 * `CAPTURAS=<carpeta>` guarda una captura de cada caso.
 */
const RUTA = '/workers/bank-statement';

async function convertir(page: Page) {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('tab', { name: 'Consola' }).click();
  const consola = page.locator('.worker-console');
  await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });
  await consola.getByTestId('select-escenario').click();
  await page.getByTestId('select-escenario-option-valid-basic').click();
  await consola.getByRole('button', { name: 'Convertir' }).click();
  return consola;
}

async function captura(page: Page, nombre: string) {
  const carpeta = process.env.CAPTURAS;
  if (carpeta) await page.screenshot({ path: `${carpeta}/${nombre}.png`, fullPage: true });
}

test('un PDF repetido en revisión por entidad desconocida se explica y enlaza a resolverlo', async ({
  page,
}) => {
  await mockStatementTriage(page, 'repetido');
  const consola = await convertir(page);

  const aviso = consola.getByTestId('statement-console-outcome');
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toContainText('no se reconoció la entidad');
  await expect(aviso).toContainText('ya estaba en el motor');
  await expect(aviso.getByRole('link', { name: 'Abrir la revisión de extractos' })).toHaveAttribute(
    'href',
    '/workers/bank-statement?vista=revision',
  );
  await expect(aviso.getByRole('link', { name: 'Ver el padrón de entidades' })).toBeVisible();
  // Ya no se anuncia como si se hubiera encolado algo nuevo.
  await expect(page.locator('.toast-viewport').getByText('Extracto encolado')).toHaveCount(0);
  await captura(page, 'consola-pdf-repetido-en-revision');
});

test('una ejecución cerrada sin movimientos lo dice en vez de quedarse en blanco', async ({
  page,
}) => {
  await mockStatementTriage(page, 'sinMovimientos');
  const consola = await convertir(page);

  const aviso = consola.getByTestId('statement-console-outcome');
  await expect(aviso).toContainText('Terminó sin movimientos', { timeout: 30_000 });
  await expect(
    page.locator('.toast-viewport').getByText(/Hay resultado y es utilizable/),
  ).toHaveCount(0);
  await captura(page, 'consola-cerrado-sin-movimientos');
});
