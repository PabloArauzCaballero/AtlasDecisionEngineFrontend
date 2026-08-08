import { expect, test, type Page } from '@playwright/test';
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

/**
 * Abre la consola y devuelve su raíz.
 *
 * Se devuelve acotada y no se busca por texto en toda la página: el panel de
 * control sigue montado al lado —oculto, para conservar su estado— y comparte
 * vocabulario con la consola («En cola», «Completado con advertencias»), así
 * que un localizador global casa con los dos y falla por ambigüedad.
 */
async function abrirConsola(page: Page) {
  await page.getByRole('tab', { name: 'Consola' }).click();
  const consola = page.locator('.worker-console');
  await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });
  return consola;
}

test.describe('pestaña Procesamiento', () => {
  test.setTimeout(180_000);

  test('una sola entrada de navegación reúne los dos workers', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTAS.semantico, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });

    // La sección tiene que existir en el cajón: una vista a la que sólo se
    // llega escribiendo la URL, en la práctica, no existe.
    const cajon = page.locator('.sidebar');
    await expect(cajon.getByText('Procesamiento', { exact: false })).toBeVisible();
    await expect(cajon.getByRole('link', { name: /^Workers$/i })).toBeVisible();

    // Y desde ahí se llega a los dos, sin volver al cajón.
    await expect(page.getByRole('tab', { name: 'Análisis Semántico' })).toBeVisible();
    await page.getByRole('tab', { name: 'Extractos Bancarios' }).click();
    await expect(page.getByRole('heading', { name: 'Extractos Bancarios' })).toBeVisible();
  });

  test('el panel de control mide salud, latencia, cola e incidencias', async ({ page }) => {
    const problemas = collectProblems(page);
    await mockWorkersBackend(page);
    await page.goto(RUTAS.extractos, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Aterriza en el panel, no en el formulario: la primera pregunta ante un
    // servicio asíncrono es si está sano, no cómo mandarle trabajo.
    const panel = page.locator('.worker-dashboard');
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // Salud: se pinta LO QUE EL MOTOR DICE. El 50 % viene del endpoint de
    // métricas, no de recontar filas aquí: una vista que lo recalculara por su
    // cuenta daría otra cifra en cuanto cambiara el tamaño de página.
    // Acotado a las tarjetas: la mediana se repite abajo, entre las cifras de
    // latencia, y un localizador global casaría con las dos.
    const cifras = panel.locator('.worker-vital-value');
    await expect(cifras.filter({ hasText: '50.0 %' })).toHaveCount(1);
    await expect(cifras.filter({ hasText: 'Encendido' })).toHaveCount(1);
    await expect(cifras.filter({ hasText: '4.5 s' })).toHaveCount(1);

    // Latencia: el gráfico sí se dibuja con las ejecuciones, una barra por cada
    // una — es lo único que un agregado no puede dar.
    await expect(panel.locator('.worker-chart-bar')).toHaveCount(4);

    // Cola: una procesándose y una esperando.
    await expect(panel.locator('.worker-queue-row')).toHaveCount(2);
    await expect(panel.locator('.worker-queue-row.is-running')).toHaveCount(1);

    // Incidencias: los dos fallos comparten código, así que son UNA causa
    // ocurrida dos veces. Enumerarlas sueltas escondería que hay una sola cosa
    // que arreglar.
    await expect(panel.locator('.worker-incident')).toHaveCount(1);
    await expect(panel.getByText('DOCUMENTO_ILEGIBLE')).toBeVisible();
    await expect(panel.getByText('2 veces')).toBeVisible();

    expect(problemas, problemas.join('\n')).toEqual([]);
  });

  test('el análisis semántico recorre en cola → procesando → resultado', async ({ page }) => {
    const problemas = collectProblems(page);
    await mockWorkersBackend(page);
    await page.goto(RUTAS.semantico, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const consola = await abrirConsola(page);

    // Los límites los publica el backend, no están escritos en la vista.
    await expect(consola.getByText(/8.000 caracteres|8,000 caracteres/)).toBeVisible({
      timeout: 30_000,
    });

    // Acotado al bloque de escenarios: `getByLabel('Escenario')` también casaba
    // con el radio que lo activa, porque su explicación menciona la palabra.
    await consola.locator('.worker-fixtures select').selectOption('gasto-claro');
    await expect(consola.getByText(/El camino feliz/i)).toBeVisible();

    await consola.getByRole('button', { name: 'Analizar' }).click();

    // No se salta directamente al resultado: se comprueba que el estado
    // intermedio existe y se ve, que es justo lo que el encargo pedía —nada de
    // una pantalla congelada mientras se procesa—.
    await expect(consola.getByText('En cola')).toBeVisible({ timeout: 20_000 });
    await expect(consola.getByRole('progressbar')).toBeVisible();

    await expect(consola.getByText('Completado con advertencias')).toBeVisible({ timeout: 30_000 });
    // Y se distingue de un éxito limpio: si dijera sólo «Completado», nadie
    // miraría un resultado que sí necesita revisión.
    await expect(consola.getByText(/Conviene revisarlo/i)).toBeVisible();

    await expect(consola.getByText('GASTOS.ALIMENTACION.SUPERMERCADO')).toBeVisible();
    await expect(consola.getByText(/91% de confianza/)).toBeVisible();
    // La rama a la que pertenece la hoja. Es lo que hace legible un código que
    // por sí solo obliga a conocer el catálogo de memoria.
    await expect(consola.locator('.worker-match-path')).toContainText('Alimentación');

    expect(problemas, problemas.join('\n')).toEqual([]);
  });

  test('los extractos muestran los movimientos y no filtran la cuenta', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTAS.extractos, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const consola = await abrirConsola(page);

    await expect(consola.getByText(/10 MiB/)).toBeVisible({ timeout: 30_000 });

    // Acotado al bloque de escenarios: `getByLabel('Escenario')` también casaba
    // con el radio que lo activa, porque su explicación menciona la palabra.
    await consola.locator('.worker-fixtures select').selectOption('valid-basic');
    await consola.getByRole('button', { name: 'Convertir' }).click();

    await expect(consola.getByText('Completado con advertencias')).toBeVisible({ timeout: 30_000 });
    await expect(consola.getByText('******7890')).toBeVisible();
    await expect(consola.getByText('PAGO SERVICIOS (CUOTA 3)')).toBeVisible();
    await expect(consola.getByText('DEPOSITO EN EFECTIVO')).toBeVisible();

    // La garantía de privacidad, comprobada sobre el DOM ya pintado y no sólo
    // sobre el contrato: el número completo no puede aparecer en ninguna parte.
    await expect(page.locator('body')).not.toContainText('1234567890');

    // Las tres descargas aparecen sólo cuando hay resultado. Son botones y no
    // enlaces: seguir un `<a href="/v1/…">` es una navegación del navegador, ahí
    // no viaja el token de la sesión y las tres devolvían 401.
    for (const nombre of [/Descargar CSV/i, /Movimientos \(JSON\)/i, /Contrato completo/i]) {
      await expect(consola.getByRole('button', { name: nombre })).toBeVisible();
    }
  });

  test('la carga de archivos es alcanzable con teclado', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTAS.extractos, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await abrirConsola(page);
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
    //
    // Acotado a la nota, no `getByText` a secas: la misma frase está también en
    // el globo de ayuda de la cabecera, y un localizador que casa con las dos
    // no comprueba que esté JUNTO al control de subida, que es donde importa.
    await expect(page.locator('.worker-privacy-note')).toContainText(/no se conserva/i);
  });

  test('un archivo que no es PDF se rechaza antes de enviarlo', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTAS.extractos, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await abrirConsola(page);
    await expect(page.locator('.worker-mode')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('radio', { name: /Cargar mi propio PDF/i }).check();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notas.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('esto no es un extracto'),
    });

    // `role=alert` dentro del formulario, no en toda la página: Next monta su
    // propio anunciador de rutas con ese mismo rol, y un localizador global casa
    // con los dos.
    await expect(page.locator('.worker-input [role="alert"]')).toContainText(
      /Sólo se admiten archivos PDF/i,
    );
    // Y no deja enviar: la comprobación previa existe para no subir un archivo
    // que el backend va a rechazar igualmente.
    await expect(page.getByRole('button', { name: 'Convertir' })).toBeDisabled();
  });

  test('ninguna de las dos vistas desplaza la página en horizontal', async ({ page }) => {
    // La tabla de movimientos es ancha y en un teléfono, sin acotarla, empuja el
    // ancho del documento y se desplaza TODA la página, no sólo la tabla.
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWorkersBackend(page);

    // Las dos caras de cada worker: el panel trae gráfico, cola y tabla de
    // incidencias, y el desbordamiento no se hereda de una a la otra.
    for (const ruta of Object.values(RUTAS)) {
      for (const vista of ['panel', 'consola'] as const) {
        await page.goto(`${ruta}?vista=${vista}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });
        await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
        const desborde = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(desborde, `${ruta} (${vista}) desborda ${desborde}px`).toBeLessThanOrEqual(1);
      }
    }
  });
});
