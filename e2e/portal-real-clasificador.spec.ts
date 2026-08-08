import { expect, test, type Page } from '@playwright/test';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';
import { deAplicacion, vigilar } from './support/real-portal-watch';

/**
 * El CLASIFICADOR DE GASTOS, de punta a punta y con el modelo real.
 *
 * Es la prueba que no se puede hacer con un simulado: el texto se embebe de
 * verdad contra el servidor de inferencia, el motor decide con sus umbrales
 * medidos y la vista pinta la rama del árbol que salió. Un simulado sólo
 * comprobaría que la pantalla sabe pintar una forma que el repositorio se
 * inventa.
 */

/**
 * Abre la pestaña «Consola» de un worker.
 *
 * Falla RÁPIDO y con el motivo probable escrito. Hubo una versión que esperaba a
 * que se reabriera la ventana del limitador y reintentaba: convertía un fallo de
 * 40 segundos en uno de 42 minutos sin arreglar nada, porque la causa no estaba
 * en esta prueba sino en compartir el minuto de cuota con el barrido.
 *
 * La cuota del motor (`RATE_LIMIT_MANAGEMENT_REQUESTS`, 300/min) no da para
 * correr el barrido y el clasificador seguidos: **córranse por separado**, como
 * dice el CLAUDE.md.
 */
async function abrirConsolaDeWorker(page: Page): Promise<void> {
  const consola = page.getByRole('tab', { name: 'Consola' });
  await expect(
    consola,
    'no apareció la pestaña «Consola»: casi siempre es la cuota del motor agotada ' +
      'por haber corrido el barrido en el mismo minuto. Corre este archivo solo.',
  ).toBeVisible({ timeout: 60_000 });
  await consola.click();
}

test.describe.configure({ mode: 'serial' });

test.describe('clasificador de gastos · motor real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  /* ------------------------------------------------------------------ *
   * 4 · El clasificador de gastos, de punta a punta con el modelo real
   * ------------------------------------------------------------------ */

  test('el clasificador clasifica un gasto real y enseña su rama del árbol', async ({ page }) => {
    test.setTimeout(10 * 60_000);
    let ruta = '/workers/semantic-analysis';
    const problemas = vigilar(page, () => ruta);
    await entrar(page);

    await page.goto('/workers/semantic-analysis', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await abrirConsolaDeWorker(page);

    const hechos = page.locator('.worker-facts');
    await expect(hechos).not.toHaveClass(/is-loading/, { timeout: 30_000 });
    /*
     * El marcado separa la etiqueta «Estado» de su valor, así que el texto es
     * «Estado
Disponible»: el patrón con dos puntos NO casaba nunca y estas
     * pruebas se saltaban solas, en verde y sin comprobar nada. Se busca el
     * valor, y se exige además que la vista no diga lo contrario.
     */
    const estado = await hechos.innerText();
    test.skip(/Apagado en este entorno/i.test(estado), 'Worker apagado en este motor.');
    expect(estado, 'la cabecera debe declarar el worker disponible').toMatch(/Disponible/i);

    // Texto propio: una descripción de movimiento como la escribe un banco.
    await page.getByRole('radio', { name: /Escribir un texto/i }).check();
    await page
      .locator('textarea.worker-textarea')
      .fill(`COMPRA EN SUPERMERCADO HIPERMAXI SUCURSAL NORTE BS 487,90 REF ${Date.now()}`);

    await page.getByRole('button', { name: 'Analizar' }).click();
    await expect(page.getByText(/^Completado(\s+con advertencias)?$/)).toBeVisible({
      timeout: 300_000,
    });

    const resultado = page.locator('.worker-result');
    await expect(resultado).toBeVisible();

    // 4.1 · Cayó en la hoja correcta del árbol.
    await expect(resultado.locator('.worker-match code').first()).toHaveText(
      'GASTOS.ALIMENTACION.SUPERMERCADO',
    );

    // 4.2 · Y la vista enseña la RAMA, que es lo que hace legible el código.
    await expect(resultado.locator('.worker-match-path').first()).toContainText('Alimentación');

    // 4.3 · El modelo que decidió queda a la vista: un resultado sin autor no se
    //       puede auditar después.
    await expect(resultado.locator('.worker-run-facts')).toContainText(/e5|transformer|intfloat/i);

    // 4.4 · La evidencia cita el texto analizado y no «[object Object]».
    const evidencia = resultado.locator('.worker-evidence li');
    if (await evidencia.count()) {
      await expect(evidencia.first()).not.toHaveText(/\[object Object\]/);
      await expect(evidencia.first()).toContainText(/supermercado/i);
    }

    expect(deAplicacion(problemas)).toEqual([]);
  });

  test('un movimiento sin categoría posible se abstiene en vez de inventar', async ({ page }) => {
    test.setTimeout(10 * 60_000);
    const problemas = vigilar(page, () => '/workers/semantic-analysis');
    await entrar(page);

    await page.goto('/workers/semantic-analysis', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await abrirConsolaDeWorker(page);
    const hechos = page.locator('.worker-facts');
    await expect(hechos).not.toHaveClass(/is-loading/, { timeout: 30_000 });
    const estado = await hechos.innerText();
    test.skip(/Apagado en este entorno/i.test(estado), 'Worker apagado en este motor.');
    expect(estado).toMatch(/Disponible/i);

    await page.getByRole('radio', { name: /Escribir un texto/i }).check();
    await page
      .locator('textarea.worker-textarea')
      .fill(`MOVIMIENTO VARIOS REF ${Date.now()} OP 4471`);
    await page.getByRole('button', { name: 'Analizar' }).click();
    await expect(page.getByText(/^Completado(\s+con advertencias)?$/)).toBeVisible({
      timeout: 300_000,
    });

    // La abstención tiene que LEERSE como abstención, no como un fallo del
    // sistema: es el comportamiento correcto y la vista debe explicarlo.
    const resultado = page.locator('.worker-result');
    await expect(resultado).toContainText(/Sin determinar|Ambiguo/i);
    await expect(resultado).toContainText(/No es un error|abstención|prefiere no decidir/i);

    expect(deAplicacion(problemas)).toEqual([]);
  });

  /* ------------------------------------------------------------------ *
   * 5 · Casos límite y de error del formulario del clasificador
   * ------------------------------------------------------------------ */

  test('el formulario del clasificador se defiende de los casos límite', async ({ page }) => {
    test.setTimeout(10 * 60_000);
    const problemas = vigilar(page, () => '/workers/semantic-analysis');
    await entrar(page);

    await page.goto('/workers/semantic-analysis', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await abrirConsolaDeWorker(page);
    await expect(page.locator('.worker-facts')).not.toHaveClass(/is-loading/, { timeout: 30_000 });

    const analizar = page.getByRole('button', { name: 'Analizar' });
    const textarea = page.locator('textarea.worker-textarea');
    await page.getByRole('radio', { name: /Escribir un texto/i }).check();

    // 5.1 · Vacío: no se puede enviar.
    await textarea.fill('');
    await expect(analizar).toBeDisabled();

    // 5.2 · Sólo espacios: tampoco. Es el caso que parece contenido y no lo es.
    await textarea.fill('        ');
    await expect(analizar).toBeDisabled();

    // 5.3 · Un solo carácter: es válido y debe poder enviarse. El límite inferior
    //       no puede quedar en tierra de nadie.
    await textarea.fill('X');
    await expect(analizar).toBeEnabled();

    // 5.4 · Por encima del máximo que publica el motor: se avisa y se bloquea.
    const maximo = Number(
      (await page.locator('.worker-facts').innerText())
        .match(/([\d.,]+)\s*caracteres/)?.[1]
        ?.replace(/[.,]/g, '') ?? 8000,
    );
    await textarea.fill('a'.repeat(maximo + 50));
    await expect(page.locator('.field-help.is-error')).toContainText(/excede/i);
    await expect(analizar).toBeDisabled();

    // 5.5 · Justo en el máximo: se acepta. Un «≤» escrito como «<» se ve aquí.
    await textarea.fill('a'.repeat(maximo));
    await expect(analizar).toBeEnabled();

    expect(deAplicacion(problemas)).toEqual([]);
  });

  test('el escenario inválido del catálogo falla de forma controlada', async ({ page }) => {
    test.setTimeout(10 * 60_000);
    // El rechazo del alta es lo que esta prueba provoca: no cuenta como fallo.
    const problemas = vigilar(page, () => '/workers/semantic-analysis', {
      esperadas: [/\/v1\/workers\/semantic-analysis\/runs/],
    });
    await entrar(page);

    await page.goto('/workers/semantic-analysis', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await abrirConsolaDeWorker(page);
    await expect(page.locator('.worker-facts')).not.toHaveClass(/is-loading/, { timeout: 30_000 });

    // El escenario que el motor rechaza ANTES de encolar: el portal tiene que
    // enseñar el rechazo, no quedarse esperando una ejecución que nunca existió.
    await page.locator('.worker-fixtures select').selectOption('invalid-example');
    await page.getByRole('button', { name: 'Analizar' }).click();

    // Los errores de mutación los publica el `MutationCache` global como toast,
    // no como un `role="alert"` dentro de la vista: se busca donde de verdad
    // aparecen (`src/notifications/ToastViewport.tsx`).
    const aviso0 = page.locator('.toast-viewport .toast-copy').first();
    await expect(aviso0).toBeVisible({ timeout: 60_000 });

    // Y el aviso dice algo: un toast vacío ocupa sitio y no orienta a nadie.
    const aviso = await aviso0.innerText();
    expect(aviso.trim(), 'el aviso de error debe decir algo').toMatch(/\S/);
    expect(aviso).not.toMatch(/\[object Object\]|undefined|null/);

    /*
     * El 400 es la respuesta CORRECTA y lo provoca esta prueba. El aviso que el
     * navegador emite por él llega sin URL, así que no se puede excluir por
     * ruta como el resto; se descuenta aquí, y lo que se sigue exigiendo es lo
     * que importa: que un rechazo del motor no deje al portal roto.
     */
    expect(
      deAplicacion(problemas).filter((p) => !p.includes('Failed to load resource')),
      'un rechazo del motor no puede romper el portal',
    ).toEqual([]);
  });
});
