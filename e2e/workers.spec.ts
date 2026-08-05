import { expect, test } from '@playwright/test';
import { collectProblems } from './support/backend-mock';
import { mockWorkersBackend } from './support/workers-backend';

/**
 * Las dos vistas de worker, con un ciclo de vida que avanza de verdad.
 *
 * Contra el motor simulado normal estas pantallas sólo pintan su cabecera y el
 * formulario: se estaría midiendo el encabezado creyendo medir la vista. El
 * simulado de `workers-backend.ts` progresa `QUEUED → RUNNING → terminal` con
 * cada consulta, que es lo que permite comprobar el seguimiento.
 */

const RUTAS = {
  semantico: '/workers/semantic-analysis',
  extractos: '/workers/bank-statement',
} as const;

test.describe('pestaña Procesamiento', () => {
  test.setTimeout(180_000);

  test('la navegación lleva a las dos vistas', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTAS.semantico, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });

    // La sección tiene que existir en el cajón: una vista a la que sólo se
    // llega escribiendo la URL, en la práctica, no existe.
    const cajon = page.locator('.sidebar');
    await expect(cajon.getByText('Procesamiento', { exact: false })).toBeVisible();
    await expect(cajon.getByRole('link', { name: /Análisis Semántico/i })).toBeVisible();
    await expect(cajon.getByRole('link', { name: /Extractos Bancarios/i })).toBeVisible();
  });

  test('el análisis semántico recorre en cola → procesando → resultado', async ({ page }) => {
    const problemas = collectProblems(page);
    await mockWorkersBackend(page);
    await page.goto(RUTAS.semantico, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Los límites los publica el backend, no están escritos en la vista.
    await expect(page.getByText(/8.000 caracteres|8,000 caracteres/)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel('Escenario').selectOption('valid-basic');
    await expect(page.getByText(/El camino feliz/i)).toBeVisible();

    await page.getByRole('button', { name: 'Analizar' }).click();

    // No se salta directamente al resultado: se comprueba que el estado
    // intermedio existe y se ve, que es justo lo que el encargo pedía —nada de
    // una pantalla congelada mientras se procesa—.
    await expect(page.getByText('En cola')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('progressbar')).toBeVisible();

    await expect(page.getByText('Completado con advertencias')).toBeVisible({ timeout: 30_000 });
    // Y se distingue de un éxito limpio: si dijera sólo «Completado», nadie
    // miraría un resultado que sí necesita revisión.
    await expect(page.getByText(/Conviene revisarlo/i)).toBeVisible();

    await expect(page.getByText('COBRO_NO_RECONOCIDO')).toBeVisible();
    await expect(page.getByText(/91% de confianza/)).toBeVisible();

    expect(problemas, problemas.join('\n')).toEqual([]);
  });

  test('los extractos muestran los movimientos y no filtran la cuenta', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTAS.extractos, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await expect(page.getByText(/10 MiB/)).toBeVisible({ timeout: 30_000 });

    await page.getByLabel('Escenario').selectOption('valid-basic');
    await page.getByRole('button', { name: 'Convertir' }).click();

    await expect(page.getByText('Completado con advertencias')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('******7890')).toBeVisible();
    await expect(page.getByText('PAGO SERVICIOS (CUOTA 3)')).toBeVisible();
    await expect(page.getByText('DEPOSITO EN EFECTIVO')).toBeVisible();

    // La garantía de privacidad, comprobada sobre el DOM ya pintado y no sólo
    // sobre el contrato: el número completo no puede aparecer en ninguna parte.
    await expect(page.locator('body')).not.toContainText('1234567890');

    // Las tres descargas aparecen sólo cuando hay resultado.
    for (const nombre of [/Descargar CSV/i, /Movimientos \(JSON\)/i, /Contrato completo/i]) {
      await expect(page.getByRole('link', { name: nombre })).toBeVisible();
    }
  });

  test('la carga de archivos es alcanzable con teclado', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTAS.extractos, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('.worker-mode')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('radio', { name: /Cargar mi propio PDF/i }).check();

    // El input está fuera de la vista pero NO oculto: si se ocultara con
    // `display:none` saldría del árbol de accesibilidad y sólo se podría subir
    // un archivo con el ratón.
    const input = page.locator('input[type="file"]');
    await expect(input).toBeAttached();
    await expect(input).not.toBeDisabled();
    await expect(page.getByRole('button', { name: /Elegir archivo/i })).toBeVisible();

    // Y se dice qué pasa con el documento, que es lo que da derecho a subirlo.
    await expect(page.getByText(/no se conserva/i)).toBeVisible();
  });

  test('un archivo que no es PDF se rechaza antes de enviarlo', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTAS.extractos, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('.worker-mode')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('radio', { name: /Cargar mi propio PDF/i }).check();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notas.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('esto no es un extracto'),
    });

    await expect(page.getByRole('alert')).toContainText(/Sólo se admiten archivos PDF/i);
    // Y no deja enviar: la comprobación previa existe para no subir un archivo
    // que el backend va a rechazar igualmente.
    await expect(page.getByRole('button', { name: 'Convertir' })).toBeDisabled();
  });

  test('ninguna de las dos vistas desplaza la página en horizontal', async ({ page }) => {
    // La tabla de movimientos es ancha y en un teléfono, sin acotarla, empuja el
    // ancho del documento y se desplaza TODA la página, no sólo la tabla.
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWorkersBackend(page);

    for (const ruta of Object.values(RUTAS)) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(desborde, `${ruta} desborda ${desborde}px`).toBeLessThanOrEqual(1);
    }
  });
});
