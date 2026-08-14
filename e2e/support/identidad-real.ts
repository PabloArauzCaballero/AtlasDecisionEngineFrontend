import { expect, type Page } from '@playwright/test';

/**
 * Andamiaje de la corrida de identidad contra el motor real.
 *
 * Vive aparte del `.spec` por el límite de 299 líneas del repositorio, pero
 * también porque son tres decisiones que se explican una vez y se usan en cinco
 * pruebas: dónde acotar, cuándo disparar la captura y qué cuenta como error.
 */

export const EVIDENCIA = 'docs/visual-evidence/identidad';

/**
 * La vista de un worker, acotada a SU panel.
 *
 * Las pestañas que no se ven siguen montadas para conservar su estado, así que
 * `.worker-dashboard` a secas casa con el panel de los tres workers a la vez y
 * Playwright falla por ambigüedad. Se acota por el identificador del panel, que
 * `Tabs` deriva del código del worker.
 */
export function panelDeWorker(page: Page, code: string) {
  return page.locator(`#workers-panel-${code}`);
}

export function panelDeIdentidad(page: Page) {
  return panelDeWorker(page, 'identity-verification');
}

/**
 * Captura de página entera, con la vista asentada y el desplazamiento arriba.
 *
 * Dos guardas, y las dos por un fallo medido:
 *
 * 1. **Se espera una señal POSITIVA** (`.sidebar` o `.login-page`), no la
 *    desaparición del indicador de carga. `PortalSessionGuard` monta ese
 *    indicador DESPUÉS del primer render, así que «no está» y «todavía no
 *    está» son indistinguibles: la primera versión de esta prueba dejó como
 *    evidencia del acceso una foto del spinner «Recuperando sesión». Es el
 *    mismo error que ya documenta el guion de evidencia responsive.
 * 2. **Se sube al principio** antes de disparar. `fullPage` cose la página en
 *    tiras y el cajón lateral está anclado: empezando a media página, el cajón
 *    sale dibujado sobre la cabecera y la evidencia parece un defecto de
 *    maquetación que no existe.
 */
export async function capturar(page: Page, nombre: string): Promise<void> {
  await expect(page.locator('.sidebar, .login-page').first()).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${EVIDENCIA}/${nombre}.png`, fullPage: true });
}

/**
 * Errores de consola y de red que la corrida no debe producir.
 *
 * El 401 se trata aparte y **no se ignora**: se recoge en su propia lista y la
 * prueba comprueba que sólo ocurre en `/v1/session/`, que es el refresco de
 * credencial que el cliente resuelve solo. Un 401 en cualquier otra ruta sí es
 * un defecto —el rol no alcanza y la vista lo estaría escondiendo—, y un filtro
 * que los tirara todos lo taparía.
 *
 * Chromium además escribe «Failed to load resource … 401» en la consola por
 * cada uno de esos refrescos: es el MISMO suceso visto dos veces, así que se
 * descuenta de la lista de consola en vez de contarse dos veces.
 */
export function vigilar(page: Page) {
  const consola: string[] = [];
  const red: string[] = [];
  const sesion401: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (/Failed to load resource.*401/.test(msg.text())) return;
    consola.push(msg.text());
  });
  page.on('pageerror', (error) => consola.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    const url = response.url();
    if (!url.includes('/v1/')) return;
    if (response.status() === 401) {
      sesion401.push(url);
      return;
    }
    if (response.status() >= 400) {
      red.push(`${response.status()} ${response.request().method()} ${url}`);
    }
  });
  return { consola, red, sesion401 };
}
