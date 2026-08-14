import { expect, test, type Page } from '@playwright/test';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';

/**
 * El CRUD del árbol de categorías, contra el motor REAL.
 *
 * Esta pantalla edita el catálogo con el que el worker semántico decide, así que
 * probarla contra un simulado comprobaría que el formulario sabe pintar una
 * respuesta que este repositorio se inventa. Lo que hay que saber es otra cosa:
 * que lo escrito **llega a la base del motor y vuelve**, que un árbol pegado en
 * JSON crea todos sus registros en orden de padre a hijo, y que la prueba en
 * seco no escribe nada.
 *
 * Cada paso deja una captura en `docs/visual-evidence/categorias/`. Las
 * capturas no son el objetivo —las afirmaciones lo son—, pero un CRUD que
 * alguien tiene que revisar se explica mejor enseñándolo.
 */

const EVIDENCIA = 'docs/visual-evidence/categorias';

/*
 * Códigos FIJOS, no uno por corrida.
 *
 * Esta prueba escribe en el catálogo real del tenant, y el catálogo es la
 * memoria del clasificador. Con un sufijo por corrida cada ejecución dejaba tres
 * categorías más: a la décima, el árbol tenía más basura de prueba que dominio.
 * Con códigos fijos la escritura es un `upsert` sobre las mismas tres filas y el
 * residuo no crece nunca. Se desactivan al final, que es lo máximo que el motor
 * permite —no borra, porque las trazas citan el código— y deja el árbol limpio a
 * la vista.
 */
const CODIGO = 'GASTOS.PRUEBA_E2E';
const RAMA_JSON = 'GASTOS.INYECTADA_E2E';
const HOJA_JSON = `${RAMA_JSON}.HOJA`;

async function irACategorias(page: Page): Promise<void> {
  /*
   * Se entra por la ruta del worker y no por `/workers?worker=…`: el
   * concentrador existe, pero la ruta propia es la que alguien comparte cuando
   * dice «mira las categorías del semántico», y es la que tiene que funcionar.
   */
  await page.goto('/workers/semantic-analysis?vista=categorias', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await expect(page.getByRole('tab', { name: 'Categorías' })).toBeVisible({ timeout: 60_000 });
  // El árbol tarda lo que tarde el motor en devolver el catálogo entero.
  await expect(page.locator('.categoria-arbol')).toBeVisible({ timeout: 60_000 });
}

/**
 * Una fila por su código EXACTO.
 *
 * Filtrar por texto contenido no sirve aquí: el código de una rama es prefijo
 * del de sus hojas —`GASTOS.X` está dentro de `GASTOS.X.HOJA`— y el localizador
 * casaría con las dos, fallando por ambigüedad en vez de por un defecto.
 */
function fila(page: Page, code: string) {
  return page.locator('.categoria-fila').filter({ has: page.getByText(code, { exact: true }) });
}

test.describe.configure({ mode: 'serial' });

test.describe('árbol de categorías · CRUD contra el motor real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  test('el árbol se lee, se crea una categoría y se desactiva', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await entrar(page);
    await irACategorias(page);

    // 1 · El árbol que el motor tiene sembrado, como árbol.
    const filas = page.locator('.categoria-fila');
    expect(await filas.count(), 'el catálogo sembrado no puede estar vacío').toBeGreaterThan(20);
    await page.screenshot({ path: `${EVIDENCIA}/1-arbol.png`, fullPage: false });

    // 2 · Alta. El formulario aparece en la misma pantalla: corregir el catálogo
    //     es lo que se hace justo después de ver un movimiento sin clasificar.
    await page.getByRole('button', { name: /Nueva categoría/ }).click();
    const formulario = page.locator('.categoria-form');
    await expect(formulario).toBeVisible();

    await formulario.getByLabel(/^Código/).fill(CODIGO);
    await formulario.getByLabel(/^Nombre/).fill('Prueba de extremo a extremo');
    await formulario
      .getByLabel(/^Descripción/)
      .fill('Categoría creada por la prueba automática para verificar el CRUD contra el motor.');
    await formulario.getByLabel(/^Categoría padre/).selectOption('GASTOS');
    /*
     * `exact` porque «Ejemplos» está contenido en «Contraejemplos»: sin él, el
     * localizador casa con los dos campos y la prueba falla por ambigüedad en
     * vez de por un defecto. Los dos textos son correctos en la vista —el
     * contraejemplo se llama así—; quien tiene que ser preciso es la prueba.
     */
    await formulario
      .getByLabel(/^Ejemplos \(uno por línea\)/)
      .fill('PAGO DE PRUEBA E2E\nCARGO DE PRUEBA AUTOMATICA');
    await formulario.getByLabel(/^Contraejemplos \(uno por línea\)/).fill('ABONO NOMINA EMPRESA');
    await page.screenshot({ path: `${EVIDENCIA}/2-formulario.png` });

    await formulario.getByRole('button', { name: /Crear categoría/ }).click();

    // La afirmación que importa: la fila vuelve del MOTOR, no del estado local.
    // La lista se recarga preguntando de nuevo, así que verla aquí significa que
    // se escribió de verdad.
    await expect(page.locator('.categoria-fila', { hasText: CODIGO })).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: `${EVIDENCIA}/3-creada.png` });

    // 3 · Baja lógica: sale del catálogo del clasificador y sigue siendo legible,
    //     porque las trazas ya emitidas citan su código.
    await page.getByRole('button', { name: `Desactivar ${CODIGO}` }).click();
    await expect(page.locator('.categoria-fila.is-inactive', { hasText: CODIGO })).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: `${EVIDENCIA}/4-desactivada.png` });
  });

  test('un árbol pegado en JSON crea todos sus registros', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await entrar(page);
    await irACategorias(page);

    const json = JSON.stringify(
      [
        // A propósito la HOJA va primera: el motor ordena por profundidad, así
        // que el orden del array no puede importar. Si importara, esta prueba
        // fallaría con `SEMANTIC_CATEGORY_TREE_BROKEN`.
        {
          code: HOJA_JSON,
          name: 'Hoja inyectada',
          description: 'Hoja creada desde JSON para verificar la inyección masiva.',
          parentCode: RAMA_JSON,
          acceptanceThreshold: 0.62,
          positiveExamples: ['PAGO INYECTADO DE PRUEBA'],
          counterExamples: ['ABONO NOMINA EMPRESA'],
        },
        {
          code: RAMA_JSON,
          name: 'Rama inyectada',
          description: 'Rama creada desde JSON. Agrupa: la clasificación recae en sus hojas.',
          parentCode: 'GASTOS',
          acceptanceThreshold: 1,
          positiveExamples: [],
          counterExamples: [],
        },
      ],
      null,
      2,
    );

    const filasAntes = await page.locator('.categoria-fila').count();
    await page.getByLabel('JSON del árbol de categorías').fill(json);
    await page.screenshot({ path: `${EVIDENCIA}/5-json.png` });

    // 1 · En seco. No debe escribir nada, y debe decir exactamente qué haría.
    await page.getByRole('button', { name: /Probar en seco/ }).click();
    const resumen = page.locator('.categoria-import-resumen');
    await expect(resumen).toContainText('Prueba en seco', { timeout: 30_000 });
    await expect(resumen).toContainText(RAMA_JSON);
    /*
     * Lo que la prueba en seco promete no es «no existe», que dejaría de ser
     * cierto en la segunda corrida: es que NO CAMBIA NADA. Se compara el número
     * de filas antes y después, que es la afirmación que se sostiene tanto si el
     * árbol está limpio como si ya trae lo de la corrida anterior.
     */
    await expect(
      page.locator('.categoria-fila'),
      'la prueba en seco no puede haber escrito nada',
    ).toHaveCount(filasAntes);
    await page.screenshot({ path: `${EVIDENCIA}/6-en-seco.png` });

    // 2 · De verdad.
    await page.getByRole('button', { name: /^Inyectar$/ }).click();
    await expect(resumen).toContainText('Inyectado', { timeout: 30_000 });
    await expect(fila(page, RAMA_JSON)).toBeVisible({ timeout: 30_000 });
    /*
     * La hoja vive DENTRO de su rama y el árbol arranca con las ramas cerradas,
     * así que hay que abrirla. Comprobarlo así verifica dos cosas de una: que la
     * hoja se creó y que el plegado funciona.
     */
    await fila(page, RAMA_JSON).getByRole('button', { expanded: false }).click();
    await expect(fila(page, HOJA_JSON)).toBeVisible();
    await page.screenshot({ path: `${EVIDENCIA}/7-inyectado.png`, fullPage: true });

    // 3 · La rama no se puede desactivar mientras su hoja siga activa: un árbol
    //     con una rama muerta y hojas vivas colgando se lee mal en cualquier
    //     informe, y el motor lo impide en vez de dejarlo pasar.
    const botonBaja = fila(page, RAMA_JSON).getByRole('button', { name: /^Desactivar/ });
    await botonBaja.scrollIntoViewIfNeeded();
    await botonBaja.click();
    // El motor lo rechaza y el portal lo cuenta en un aviso: el mensaje dice qué
    // hacer —desactivar las hojas primero—, que es lo que separa un error útil
    // de un «no se pudo».
    await expect(
      page.locator('.toast').filter({ hasText: /hija|activa/i }),
      'el aviso de éxito de la inyección sigue en pantalla, así que se espera al que importa',
    ).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${EVIDENCIA}/8-rama-con-hijas.png` });

    /*
     * Y se recoge: primero la hoja, después la rama. Ese orden no es cortesía,
     * es el que el motor exige —y desactivarlas en él demuestra que la regla de
     * arriba se puede cumplir, no sólo que se aplica—.
     */
    for (const code of [HOJA_JSON, RAMA_JSON]) {
      const boton = fila(page, code).getByRole('button', { name: /^Desactivar/ });
      await boton.scrollIntoViewIfNeeded();
      await boton.click();
      await expect(fila(page, code).and(page.locator('.is-inactive'))).toBeVisible({
        timeout: 30_000,
      });
    }
  });
});
