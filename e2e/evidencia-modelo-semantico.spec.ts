import { expect, test, type Page } from '@playwright/test';
import { mockWorkersBackend } from './support/workers-backend';

/**
 * Evidencia visual de la pestaña «Configuración» del worker semántico.
 *
 * ## Qué afirma
 *
 * 1. **La pestaña existe sólo en el semántico** y enseña qué está en uso y de dónde sale.
 * 2. **Elegir OpenRouter cambia los modelos a los del catálogo**, con precio a la vista.
 * 3. **Probar antes de guardar** enseña quién respondió, latencia y coste por nivel, y
 *    marca el nivel que falló sin esconder al otro.
 * 4. **Guardar manda exactamente lo elegido** y la pantalla pasa a decir que lo dicta el portal.
 *
 * ## Por qué el backend va doblado
 *
 * Lo que se prueba es la PANTALLA. Probar de verdad gasta créditos de OpenRouter y ata la
 * prueba a que el motor, la base y el proveedor estén arriba; el adaptador y el servicio ya
 * tienen sus pruebas en el motor, y el humo real (`openrouter-smoke.spec.ts`) es opt-in allí.
 */

const OUT = 'docs/visual-evidence';

const ENTORNO = {
  mode: 'cascade',
  applies: true,
  effective: {
    gateway: 'litellm',
    fastModel: 'semantic-classifier-fast',
    deepModel: 'semantic-classifier-deep',
    source: 'environment',
    version: 0,
    updatedBy: null,
    updatedAt: null,
  },
  litellm: {
    available: true,
    fastModel: 'semantic-classifier-fast',
    deepModel: 'semantic-classifier-deep',
  },
  openrouter: {
    available: true,
    fastModel: 'openai/gpt-4.1-mini',
    deepModel: 'anthropic/claude-sonnet-4.5',
  },
};

const CATALOGO = {
  fetchedAt: '2026-09-04T12:00:00.000Z',
  models: [
    {
      id: 'anthropic/claude-sonnet-4.5',
      name: 'Anthropic: Claude Sonnet 4.5',
      contextLength: 1_000_000,
      promptUsdPerMillion: 3,
      completionUsdPerMillion: 15,
      recommended: true,
    },
    {
      id: 'google/gemini-2.5-flash',
      name: 'Google: Gemini 2.5 Flash',
      contextLength: 1_048_576,
      promptUsdPerMillion: 0.3,
      completionUsdPerMillion: 2.5,
      recommended: false,
    },
    {
      id: 'openai/gpt-4.1-mini',
      name: 'OpenAI: GPT-4.1 Mini',
      contextLength: 1_047_576,
      promptUsdPerMillion: 0.4,
      completionUsdPerMillion: 1.6,
      recommended: true,
    },
  ],
};

/** Lo que devolvió el humo real del 04/09: cifras de verdad, no inventadas. */
const SONDA = {
  gateway: 'openrouter',
  tiers: [
    {
      tier: 'FAST',
      model: 'openai/gpt-4.1-mini',
      ok: true,
      respondedBy: 'openai/gpt-4.1-mini@OpenAI',
      latencyMs: 3984,
      usage: { totalTokens: 507, estimatedCost: 0.0003672 },
      topCategory: 'GASTOS.SUPERMERCADO',
      confidence: 0.8,
    },
    {
      tier: 'DEEP',
      model: 'google/gemini-2.5-flash',
      ok: false,
      latencyMs: 412,
      error: 'OpenRouter respondió con HTTP 400.',
    },
  ],
};

interface Dobles {
  guardados: unknown[];
}

/**
 * El backend de workers compartido, más las rutas de configuración del modelo.
 *
 * Las otras pestañas del worker siguen MONTADAS aunque no se vean —conservan
 * su estado— y el panel pide métricas al cargar: un doble que sólo supiera de
 * `model-settings` dejaba al panel leyendo `latency.p50Ms` sobre una página
 * vacía y tumbaba la vista entera. Playwright resuelve las rutas en orden
 * inverso de registro, así que las de aquí, registradas después, ganan.
 */
async function mockBackend(page: Page): Promise<Dobles> {
  const dobles: Dobles = { guardados: [] };
  let vigente: typeof ENTORNO = ENTORNO;

  await mockWorkersBackend(page);
  await page.route('**/model-settings**', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.includes('/model-settings/catalog')) return route.fulfill({ json: CATALOGO });
    if (url.includes('/model-settings/test')) return route.fulfill({ json: SONDA });
    if (request.method() === 'PUT') {
      const cuerpo = request.postDataJSON() as {
        gateway: string;
        fastModel: string;
        deepModel: string;
      };
      dobles.guardados.push(cuerpo);
      vigente = {
        ...vigente,
        effective: {
          ...cuerpo,
          source: 'portal',
          version: 1,
          updatedBy: 'ana@atlas',
          updatedAt: '2026-09-04T15:30:00.000Z',
        },
      } as typeof ENTORNO;
    }
    return route.fulfill({ json: vigente });
  });
  return dobles;
}

test('la configuración del modelo se prueba y se guarda desde el worker', async ({ page }) => {
  test.setTimeout(120_000);
  const dobles = await mockBackend(page);
  await page.setViewportSize({ width: 1440, height: 1100 });

  await page.goto('/workers/semantic-analysis?vista=configuracion', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  // --- 1. Lo que está en uso, y de dónde sale ----------------------------------
  const panel = page.locator('.panel', { hasText: 'Modelo del worker' });
  await panel.waitFor({ timeout: 30_000 });
  await expect(panel).toContainText('LiteLLM (gateway propio)');
  await expect(panel).toContainText('semantic-classifier-deep');
  await expect(panel).toContainText('Configurado por el entorno del motor');
  await expect(panel.getByRole('button', { name: /^Guardar/ })).toBeDisabled();

  // --- 2. OpenRouter, con el catálogo y sus precios -----------------------------
  await panel.getByRole('radio', { name: /OpenRouter/ }).check();
  const profundo = panel.getByLabel(/Nivel profundo/);
  await expect(profundo).toHaveValue('anthropic/claude-sonnet-4.5');
  // El precio va en la propia opción: es lo que se compara al elegir.
  await expect(profundo.locator('option', { hasText: 'gemini-2.5-flash' })).toContainText(
    '$0.30 / $2.50 por M',
  );
  await profundo.selectOption('google/gemini-2.5-flash');
  await expect(panel.getByRole('button', { name: /^Guardar/ })).toBeEnabled();

  // --- 3. Probar antes de guardar ------------------------------------------------
  await panel.getByRole('button', { name: 'Probar con una glosa' }).click();
  const sonda = panel.locator('.modelo-sonda');
  await sonda.waitFor({ timeout: 15_000 });
  await expect(sonda).toContainText('openai/gpt-4.1-mini@OpenAI');
  await expect(sonda).toContainText('3984 ms');
  await expect(sonda).toContainText('$0.000367 · 507 tokens');
  await expect(sonda).toContainText('GASTOS.SUPERMERCADO · 80 %');
  // El nivel que falló se ve, y no esconde al que respondió.
  await expect(sonda.locator('tr.is-error')).toContainText('HTTP 400');

  await page.screenshot({
    path: `${OUT}/30-modelo-semantico-configuracion.png`,
    fullPage: true,
    animations: 'disabled',
  });

  // --- 4. Guardar manda exactamente lo elegido ------------------------------------
  await panel.getByRole('button', { name: /^Guardar/ }).click();
  await expect.poll(() => dobles.guardados.length).toBe(1);
  expect(dobles.guardados[0]).toEqual({
    gateway: 'openrouter',
    fastModel: 'openai/gpt-4.1-mini',
    deepModel: 'google/gemini-2.5-flash',
  });
  await expect(panel).toContainText('desde el portal por ana@atlas');
  await expect(panel.getByRole('button', { name: /Volver al entorno/ })).toBeVisible();

  await panel.screenshot({
    path: `${OUT}/31-modelo-semantico-guardado.png`,
    animations: 'disabled',
  });
});

test('los demás workers no ofrecen la pestaña', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/workers/bank-statement?vista=configuracion', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await expect(page.getByRole('tab', { name: 'Panel de control' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Configuración' })).toHaveCount(0);
});
