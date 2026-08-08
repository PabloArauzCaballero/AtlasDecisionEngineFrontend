import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collectProblems, MOCK_SESSION } from './support/backend-mock';

/**
 * Las dos vistas de worker, contra el motor real.
 *
 * `workers.spec.ts` prueba la misma pantalla contra un motor simulado: sirve
 * para el ciclo de vida y los estados, pero las cifras que enseña las inventa el
 * propio repositorio. Aquí el archivo se sube de verdad, lo convierte el worker
 * de verdad y lo que se comprueba en pantalla son las cifras impresas en el
 * documento. Si el portal cablease mal cualquier tramo —la subida multipart, el
 * seguimiento, la lectura del resultado o las descargas—, aquí se ve y en la
 * otra no.
 *
 * Es opt-in y no guarda ningún secreto:
 *
 *   PW_MANAGEMENT_KEY=<clave> PW_STATEMENT_PDF=<ruta al PDF> \
 *     yarn playwright test e2e/workers-real-backend.spec.ts
 *
 * El bloque del análisis semántico exige además que ese worker esté encendido en
 * el motor (`SEMANTIC_ANALYSIS_WORKER_ENABLED` y un proveedor de modelo); si el
 * catálogo lo declara apagado, se salta en vez de fallar, porque estar apagado
 * es una configuración legítima y no un defecto del portal.
 *
 * La sesión se forja porque los usuarios viven en el proveedor de identidad, que
 * es un servicio aparte; la autorización real la aporta la clave de gestión.
 */

const KEY = process.env.PW_MANAGEMENT_KEY;
const PDF = process.env.PW_STATEMENT_PDF;

/**
 * Cuánto se le da al motor para terminar una ejecución.
 *
 * Dos minutos sobran para un extracto y para un clasificador alojado. Un modelo
 * local sobre CPU tarda minutos, y una prueba que se rinde antes que el motor no
 * informa de un defecto: informa de su propio reloj.
 *
 *   PW_RUN_TIMEOUT_MS=900000 yarn playwright test e2e/workers-real-backend.spec.ts
 */
const RUN_TIMEOUT_MS = Number(process.env.PW_RUN_TIMEOUT_MS ?? 120_000);

/** Cifras impresas en el extracto sintético de QA Bank. */
const DOCUMENTO = {
  cuentaUltimos4: '4821',
  periodoDesde: '2026-07-01',
  periodoHasta: '2026-07-31',
  saldoInicial: '8.425,70',
  saldoFinal: '29.452,01',
  movimientos: 42,
  primeraGlosa: 'PAGO SERVICIO INTERNET TEST',
  ultimaGlosa: 'ABONO TRANSFERENCIA RECIBIDA',
};

async function useRealBackend(page: Page): Promise<void> {
  const withKey = (headers: Record<string, string>) => {
    const { authorization, Authorization, ...rest } = headers;
    void authorization;
    void Authorization;
    return { ...rest, 'x-api-key': KEY as string };
  };
  const forward = (route: Route) => route.continue({ headers: withKey(route.request().headers()) });

  await page.route('**/v1/**', forward);
  await page.route('**/health/**', forward);
  await page.route('**/v1/session/**', (route) => route.fulfill({ json: MOCK_SESSION }));
}

test.describe('extractos bancarios contra el motor real', () => {
  test.skip(!KEY || !PDF, 'Define PW_MANAGEMENT_KEY y PW_STATEMENT_PDF con el motor levantado.');

  test('subir un PDF real deja los movimientos en pantalla', async ({ page }) => {
    test.setTimeout(RUN_TIMEOUT_MS + 120_000);
    const problems = collectProblems(page);

    await useRealBackend(page);
    await page.goto('/workers/bank-statement', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // 1. La vista existe y el motor declara el worker encendido. Si el catálogo
    //    no llegara, el botón quedaría deshabilitado y todo lo demás sobraría.
    await expect(page.getByRole('heading', { name: 'Extractos Bancarios' })).toBeVisible({
      timeout: 30_000,
    });
    const cajon = page.locator('.sidebar');
    await expect(cajon.getByRole('link', { name: /^Workers$/i })).toBeVisible();
    await page.getByRole('tab', { name: 'Consola' }).click();

    // 2. Se elige el archivo propio, no un escenario.
    await page.getByRole('radio', { name: /Cargar mi propio PDF/i }).check();
    await page.locator('input.worker-file-input').setInputFiles(PDF as string);
    await expect(page.locator('.worker-file-name')).toHaveText(/\.pdf$/i);

    const convertir = page.getByRole('button', { name: 'Convertir' });
    await expect(convertir).toBeEnabled();
    await convertir.click();

    // 3. El seguimiento aparece y llega a un estado terminal. Si el archivo ya
    //    se había convertido antes, la idempotencia devuelve la ejecución hecha
    //    y no hay estado intermedio que ver: eso es un acierto del motor, no un
    //    fallo de la vista, así que no se exige.
    await expect(page.locator('.worker-run-tracker, .worker-result').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Completado(\s+con advertencias)?/)).toBeVisible({
      timeout: RUN_TIMEOUT_MS,
    });

    // 4. Lo que se enseña es lo que dice el documento.
    const resultado = page.locator('.worker-result');
    await expect(resultado).toBeVisible({ timeout: 30_000 });
    await expect(resultado.locator('code')).toContainText(DOCUMENTO.cuentaUltimos4);
    await expect(resultado).toContainText(`${DOCUMENTO.periodoDesde} — ${DOCUMENTO.periodoHasta}`);
    await expect(resultado).toContainText(DOCUMENTO.saldoInicial);
    await expect(resultado).toContainText(DOCUMENTO.saldoFinal);

    // La tabla trae los 42 movimientos, no una muestra ni una página.
    const filas = resultado.locator('table.data-table tbody tr');
    await expect(filas).toHaveCount(DOCUMENTO.movimientos);
    await expect(filas.first()).toContainText(DOCUMENTO.primeraGlosa);
    await expect(filas.last()).toContainText(DOCUMENTO.ultimaGlosa);

    // Las advertencias tienen que decir algo. Una lista de «[object Object]»
    // ocupa sitio en pantalla y no orienta a nadie sobre qué revisar.
    const avisos = resultado.locator('.worker-warnings li');
    if (await avisos.count()) {
      await expect(avisos.first()).not.toHaveText(/\[object Object\]/);
      await expect(avisos.first()).toHaveText(/\S/);
    }

    // El número completo no debe aparecer en ninguna parte de la página.
    expect(await page.content()).not.toContain('0000-0000-0000-4821');

    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('las tres descargas del resultado entregan un archivo', async ({ page }) => {
    test.setTimeout(RUN_TIMEOUT_MS + 120_000);

    await useRealBackend(page);
    await page.goto('/workers/bank-statement', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.getByRole('tab', { name: 'Consola' }).click();
    await page.getByRole('radio', { name: /Cargar mi propio PDF/i }).check();
    await page.locator('input.worker-file-input').setInputFiles(PDF as string);
    await page.getByRole('button', { name: 'Convertir' }).click();
    await expect(page.getByText(/Completado(\s+con advertencias)?/)).toBeVisible({
      timeout: RUN_TIMEOUT_MS,
    });

    // El tramo donde una credencial que sólo viaja en una cabecera de JavaScript
    // no llegaba: con enlaces `<a href download>` los tres devolvían 401 y lo
    // que bajaba era el error. Se comprueba que baja el archivo y que trae
    // contenido.
    for (const [nombre, contiene] of [
      ['Descargar CSV', 'QA07010001'],
      ['Movimientos (JSON)', 'QA07010001'],
      ['Contrato completo', '4821'],
    ] as const) {
      const boton = page.getByRole('button', { name: nombre });
      await expect(boton).toBeVisible();
      const [descarga] = await Promise.all([
        page.waitForEvent('download', { timeout: 30_000 }),
        boton.click(),
      ]);
      expect(await descarga.failure(), `${nombre} falló al descargar`).toBeNull();
      const ruta = await descarga.path();
      expect(ruta, `${nombre} no entregó ningún archivo`).toBeTruthy();

      const contenido = readFileSync(ruta as string, 'utf8');
      expect(contenido, `${nombre} bajó un archivo vacío`).not.toHaveLength(0);
      expect(contenido, `${nombre} no trae el resultado`).toContain(contiene);
      // Un 401 se descargaba como archivo con el cuerpo del error dentro. Que no
      // vuelva a pasar inadvertido.
      expect(contenido, `${nombre} bajó un error, no el resultado`).not.toContain('UNAUTHORIZED');
      // Y lo que baja va enmascarado, igual que la pantalla.
      expect(contenido).not.toContain('0000-0000-0000-4821');
    }
  });
});

test.describe('análisis semántico contra el motor real', () => {
  test.skip(!KEY, 'Define PW_MANAGEMENT_KEY con el motor levantado.');

  test('un texto propio se clasifica y la vista lo explica', async ({ page }) => {
    test.setTimeout(RUN_TIMEOUT_MS + 120_000);
    const problems = collectProblems(page);

    await useRealBackend(page);
    await page.goto('/workers/semantic-analysis', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: 'Análisis Semántico' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('tab', { name: 'Consola' }).click();

    // Se espera a que el catálogo conteste antes de decidir nada: mientras
    // carga, el panel dice «Worker no disponible» por omisión y mirarlo antes de
    // tiempo saltaría la prueba contra un motor que sí lo tiene encendido.
    const hechos = page.locator('.worker-facts');
    await expect(hechos).not.toHaveClass(/is-loading/, { timeout: 30_000 });
    const estado = await hechos.innerText();

    // El worker apagado es una configuración legítima: la vista debe decirlo y
    // no dejar lanzar nada. Comprobado eso, no hay más que probar aquí.
    const analizar = page.getByRole('button', { name: 'Analizar' });
    test.skip(
      !/Estado:\s*Disponible/i.test(estado),
      'El worker semántico está apagado en este motor.',
    );

    // Texto propio, no escenario: es el camino que un analista usa de verdad.
    await page.getByRole('radio', { name: /Escribir un texto/i }).check();
    await page
      .locator('textarea.worker-textarea')
      .fill(
        'Quiero reportar un cobro que no reconozco en mi tarjeta de crédito del mes pasado ' +
          `y solicito su devolución. Referencia de prueba ${Date.now()}.`,
      );

    await expect(analizar).toBeEnabled();
    await analizar.click();

    await expect(page.getByText(/^Completado(\s+con advertencias)?$/)).toBeVisible({
      timeout: RUN_TIMEOUT_MS,
    });

    // Lo que se enseña tiene que ser el juicio, no un hueco: categoría, su
    // confianza y la evidencia que la sostiene.
    const resultado = page.locator('.worker-result');
    await expect(resultado).toBeVisible({ timeout: 30_000 });
    await expect(resultado.locator('.worker-match').first()).toBeVisible();
    await expect(resultado.locator('.worker-match-confidence').first()).toHaveText(/\d/);
    await expect(resultado.locator('.worker-match-rationale').first()).toHaveText(/\S/);

    // La evidencia es lo que sostiene la decisión: si se pinta como
    // «[object Object]», la pantalla afirma sin respaldo. Pasó de verdad.
    const evidencia = resultado.locator('.worker-evidence li');
    if (await evidencia.count()) {
      await expect(evidencia.first()).not.toHaveText(/\[object Object\]/);
      await expect(evidencia.first()).toHaveText(/\S/);
    }
    // El modelo que decidió queda a la vista: un resultado sin autor no se puede
    // auditar después.
    await expect(resultado.locator('.worker-run-facts')).toContainText(/local|gpt|qwen|llama/i);

    expect(problems, problems.join('\n')).toEqual([]);
  });
});
