import { expect, test, type Page } from '@playwright/test';
import { mockStatementTriage, type EscenarioTriage } from './support/statement-triage-backend';

/**
 * Los cuatro desenlaces del triage de extractos, y la cola que sale de dos.
 *
 * Lo que se comprueba aquí no es que la pantalla pinte: es que cada desenlace
 * **se anuncia y se anuncia distinto**. El defecto que estas pruebas persiguen es
 * silencioso por naturaleza —un documento que acaba en la cola sin que nadie se
 * entere, o un rechazo anunciado como «no se pudo procesar»— y no lo detecta
 * ninguna aserción sobre el estado de la fila: la fila estaba bien.
 *
 * Por eso cada escenario afirma sobre el TOAST, y por eso el toast se busca en la
 * banda real (`.toast-viewport`, que se monta en un portal sobre el `body`): un
 * `toast.success(...)` en el código no demuestra que el aviso llegue a verse.
 */

const RUTA = '/workers/bank-statement';

async function abrirConsola(page: Page) {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('tab', { name: 'Consola' }).click();
  const consola = page.locator('.worker-console');
  await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });
  return consola;
}

/** Lanza una conversión desde un escenario y espera a que el motor la cierre. */
async function convertir(page: Page) {
  const consola = await abrirConsola(page);
  await consola.getByLabel('Escenario').selectOption('valid-basic');
  await consola.getByRole('button', { name: 'Convertir' }).click();
  return consola;
}

/** La banda de avisos, tal como la ve quien usa el portal. */
function toast(page: Page, titulo: string | RegExp) {
  return page.locator('.toast-viewport').getByText(titulo);
}

async function conEscenario(page: Page, escenario: EscenarioTriage) {
  await mockStatementTriage(page, escenario);
}

test.describe('un PDF que claramente no es un extracto', () => {
  test('se rechaza, se anuncia con un mensaje accionable y NO crea un pendiente', async ({
    page,
  }) => {
    await conEscenario(page, 'invalido');
    const consola = await convertir(page);

    // El estado publicado es el rechazo, no un fallo genérico.
    await expect(consola.getByText('PDF no válido').first()).toBeVisible({ timeout: 30_000 });

    /*
     * El aviso: «no se pudo procesar» y «documento pendiente» están PROHIBIDOS
     * cuando el motor tiene evidencia suficiente de que no era un extracto. Son
     * falsos —el sistema sí supo qué pasaba— y no dicen qué hacer.
     */
    await expect(toast(page, 'PDF no válido')).toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator('.toast-viewport').getByText(/no parece corresponder a un extracto bancario/i),
    ).toBeVisible();
    await expect(page.locator('.toast-viewport').getByText(/no se pudo procesar/i)).toHaveCount(0);

    // Y la garantía que sostiene toda la cola: el rechazado NO entra en ella.
    await page.getByRole('tab', { name: 'Pendientes de revisión' }).click();
    await expect(page.getByRole('heading', { name: 'Pendientes de revisión' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('.revision-caso')).toHaveCount(2);
    await expect(page.locator('.revision-lista')).not.toContainText('PDF no válido');
  });

  test('el aviso se puede cerrar y no bloquea la pantalla', async ({ page }) => {
    await conEscenario(page, 'invalido');
    await convertir(page);
    const aviso = page.locator('.toast-viewport li').first();
    await expect(aviso).toBeVisible({ timeout: 30_000 });

    // No es un modal: el contenido de debajo sigue siendo alcanzable.
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await aviso.getByRole('button', { name: /Descartar notificación/ }).click();
    await expect(aviso).toBeHidden();
  });
});

test('un documento razonablemente parecido a un extracto va a revisión, con su categoría', async ({
  page,
}) => {
  await conEscenario(page, 'dudoso');
  const consola = await convertir(page);

  await expect(consola.getByText('Pendiente de revisión').first()).toBeVisible({ timeout: 30_000 });
  await expect(toast(page, 'Documento enviado a revisión')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('tab', { name: 'Pendientes de revisión' }).click();
  const cola = page.locator('.revision-lista');
  await expect(cola).toBeVisible({ timeout: 30_000 });

  // Aparece, y aparece DENTRO de su categoría: la pestaña filtra en el servidor.
  await expect(cola).toContainText('documento-escaneado.pdf');
  await page.getByRole('tab', { name: /Documento dudoso/ }).click();
  await expect(page.locator('.revision-caso')).toHaveCount(1);
  await expect(cola).toContainText('documento-escaneado.pdf');
  await expect(cola).not.toContainText('extracto-marzo.pdf');
});

test('el vencimiento por reloj deja de hacer esperar y cae en la categoría Timeout', async ({
  page,
}) => {
  await conEscenario(page, 'timeout');
  const consola = await convertir(page);

  await expect(consola.getByText('Pendiente de revisión').first()).toBeVisible({ timeout: 30_000 });
  // El título es distinto del genérico y el texto explica POR QUÉ no se esperó.
  await expect(toast(page, 'Enviado a revisión')).toBeVisible({ timeout: 30_000 });
  await expect(
    page.locator('.toast-viewport').getByText(/más tiempo de lo esperado/i),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Pendientes de revisión' }).click();
  await page.getByRole('tab', { name: /Timeout/ }).click();
  const caso = page.locator('.revision-caso').first();
  await expect(caso).toContainText('extracto-marzo.pdf');
  // Prioridad alta: hay alguien esperando al otro lado.
  await expect(caso).toContainText('Alta');
});

test('un extracto claramente válido se procesa y no molesta a nadie', async ({ page }) => {
  await conEscenario(page, 'procesado');
  const consola = await convertir(page);

  await expect(consola.getByText('Completado').first()).toBeVisible({ timeout: 30_000 });
  await expect(toast(page, 'Extracto procesado')).toBeVisible({ timeout: 30_000 });
  // Hay movimientos extraídos, que es lo que se vino a buscar.
  await expect(consola.locator('.worker-result')).toBeVisible();

  // Y ni rastro de revisión: el camino feliz no gasta atención humana.
  await expect(page.locator('.toast-viewport').getByText(/revisión/i)).toHaveCount(0);
});

test('la cola publica sus categorías con contadores del total, no de la página', async ({
  page,
}) => {
  await conEscenario(page, 'dudoso');
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('tab', { name: 'Pendientes de revisión' }).click();

  const pestañas = page.locator('.revision-categorias');
  await expect(pestañas).toBeVisible({ timeout: 30_000 });
  /*
   * «Todos (3)» sobre una página de 2 casos: el contador viene del motor. Si se
   * dedujera de lo cargado diría 2, y nadie sabría que hay un tercero.
   */
  await expect(pestañas.getByRole('tab', { name: /Todos/ })).toContainText('3');
  await expect(pestañas.getByRole('tab', { name: /Timeout/ })).toContainText('2');
  await expect(page.locator('.revision-caso')).toHaveCount(2);
});

test('un caso hay que reclamarlo antes de poder decidirlo', async ({ page }) => {
  await conEscenario(page, 'dudoso');
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('tab', { name: 'Pendientes de revisión' }).click();

  const caso = page.locator('.revision-caso').first();
  await expect(caso).toBeVisible({ timeout: 30_000 });
  await caso.locator('summary').click();

  // Las dos confianzas, separadas y rotuladas: es la distinción que decide el caso.
  await expect(caso).toContainText('Es un extracto');
  await expect(caso).toContainText('Calidad de la extracción');

  // Sin reclamar no hay decisión que registrar: el botón ni siquiera existe.
  await expect(caso.getByRole('button', { name: 'Registrar decisión' })).toHaveCount(0);
  await expect(caso.getByRole('button', { name: 'Reclamar para revisar' })).toBeVisible();
});
