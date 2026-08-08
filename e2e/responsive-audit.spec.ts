import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { denseBackend } from './support/dense-backend';
import { AUDIT_ROUTES, AUDIT_WIDTHS } from './support/responsive-matrix';

/**
 * Generador de evidencia responsive. NO afirma nada: recorre la matriz entera
 * de rutas × anchos y deja en `docs/visual-evidence/responsive-audit.json` lo
 * que midió, para decidir sobre datos en vez de sobre impresiones.
 *
 * Va con las herramientas (`yarn test:e2e:tools`) y no con la suite: tarda
 * minutos y su resultado no dice si el código está bien, sólo qué hace.
 * Quien afirma es `responsive.spec.ts`, y usa **las mismas exclusiones** que
 * esta herramienta: si divergieran, el barrido señalaría como defectos cosas
 * que el gate acepta, y se perdería el tiempo persiguiéndolas.
 */

/** Mismo criterio que `responsive.spec.ts`. Ver allí el porqué de cada exclusión. */
const MEDIDA = `(() => {
  const doc = document.documentElement;
  const limite = doc.clientWidth + 1;

  const culpables = [];
  for (const nodo of document.querySelectorAll('body *')) {
    const caja = nodo.getBoundingClientRect();
    if (caja.width === 0 || caja.right <= limite) continue;
    if (getComputedStyle(nodo).position === 'fixed') continue;
    if (nodo.closest('.table-wrap, .graph-canvas-viewport, [data-scroll-x]')) continue;
    if (nodo.closest('[aria-hidden="true"]')) continue;
    const clase = (nodo.className || '').toString().split(' ')[0] || '(sin clase)';
    culpables.push(nodo.tagName.toLowerCase() + '.' + clase + ' se sale ' + Math.round(caja.right - limite) + 'px');
  }

  const pequenos = [];
  for (const nodo of document.querySelectorAll('button, a[href], select, [role="button"], [role="tab"]')) {
    if (nodo.closest('.sr-only') || nodo.classList.contains('sr-only')) continue;
    const caja = nodo.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) continue;
    if (caja.width >= 24 && caja.height >= 24) continue;
    const clase = (nodo.className || '').toString().split(' ')[0] || '(sin clase)';
    pequenos.push(nodo.tagName.toLowerCase() + '.' + clase + ' mide ' + Math.round(caja.width) + '×' + Math.round(caja.height));
  }

  return {
    desborde: doc.scrollWidth - doc.clientWidth,
    culpables: [...new Set(culpables)].slice(0, 8),
    pequenos: [...new Set(pequenos)].slice(0, 8),
  };
})()`;

interface Hallazgo {
  ruta: string;
  ancho: number;
  desborde?: number;
  culpables?: string[];
  pequenos?: string[];
  error?: string;
}

test('auditoría responsive · matriz completa', async ({ page }) => {
  test.setTimeout(40 * 60_000);
  await denseBackend(page);
  const hallazgos: Hallazgo[] = [];

  /*
   * El informe se escribe pase lo que pase.
   *
   * Antes se escribía sólo al final, y cuando el barrido moría a mitad quedaba
   * en disco el JSON de la corrida ANTERIOR —con su fecha vieja y sin nada que
   * lo delatase—. Leerlo daba por vigentes hallazgos de horas antes, ya
   * corregidos. Una evidencia caducada que se hace pasar por fresca es peor que
   * no tener evidencia: por eso ahora lleva su marca de tiempo y se vuelca
   * también cuando la corrida falla.
   */
  const volcar = () =>
    writeFileSync(
      'docs/visual-evidence/responsive-audit.json',
      JSON.stringify(
        {
          generado: new Date().toISOString(),
          rutas: AUDIT_ROUTES.length,
          anchos: AUDIT_WIDTHS.length,
          hallazgos,
        },
        null,
        2,
      ),
      'utf8',
    );

  try {
    for (const ancho of AUDIT_WIDTHS) {
      await page.setViewportSize({ width: ancho, height: 900 });
      for (const ruta of AUDIT_ROUTES) {
        /*
         * Una redirección en vuelo aborta el `goto` siguiente, y en desarrollo
         * Turbopack compila cada ruta la primera vez que se pide, así que una
         * puede agotar su reloj. Se reintenta una vez y, si tampoco, se anota y
         * se sigue: perder una ruta de 41 es un dato, perder el barrido entero
         * por una ruta es quedarse sin ninguno.
         */
        try {
          await page.goto(ruta, { waitUntil: 'domcontentloaded' });
        } catch {
          try {
            await page.goto(ruta, { waitUntil: 'domcontentloaded' });
          } catch (error) {
            hallazgos.push({ ruta, ancho, error: String(error).slice(0, 140) });
            continue;
          }
        }
        await page.waitForTimeout(400);

        const medida = await page.evaluate<{
          desborde: number;
          culpables: string[];
          pequenos: string[];
        }>(MEDIDA);
        if (medida.culpables.length || medida.pequenos.length) {
          hallazgos.push({ ruta, ancho, ...medida });
        }
      }
    }
  } finally {
    volcar();
  }

  console.log(`HALLAZGOS: ${hallazgos.length} sobre ${AUDIT_ROUTES.length * AUDIT_WIDTHS.length}`);
  console.log(JSON.stringify(hallazgos, null, 2));
});
