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
 * Quien afirma es `responsive.spec.ts`.
 */
test('auditoría responsive · matriz completa', async ({ page }) => {
  test.setTimeout(30 * 60_000);
  await denseBackend(page);
  const informe: unknown[] = [];

  for (const width of AUDIT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of AUDIT_ROUTES) {
      // Una redirección en vuelo aborta el `goto` siguiente. Se reintenta una
      // vez en lugar de tumbar el barrido entero por una ruta.
      try {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
      } catch {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
      }
      await page.waitForTimeout(400);

      const medida = await page.evaluate(() => {
        const doc = document.documentElement;
        const desborde = doc.scrollWidth - doc.clientWidth;

        /*
         * `desborde` NO basta en este portal: `.app-shell` lleva
         * `overflow-x: clip`, así que nada de lo que hay dentro puede ensanchar
         * el documento. Lo que antes se veía como barra de desplazamiento ahora
         * se ve como contenido recortado —peor, porque no se nota— y la medida
         * del `scrollWidth` sale siempre limpia.
         *
         * Lo que sí delata el problema es el borde derecho de cada elemento
         * contra el ancho del viewport: si sobresale, o está cortado o está
         * bajo el recorte. Se ignoran los `fixed` (velos y cajones, que se
         * posicionan a propósito fuera) y los que están dentro de un contenedor
         * que SÍ desplaza (`.table-wrap`), donde salirse es el diseño.
         */
        const culpables: string[] = [];
        for (const nodo of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
          const caja = nodo.getBoundingClientRect();
          if (caja.width === 0 || caja.right <= doc.clientWidth + 1) continue;
          const estilo = getComputedStyle(nodo);
          if (estilo.position === 'fixed') continue;
          if (nodo.closest('.table-wrap, .graph-canvas-viewport, [data-scroll-x]')) continue;
          culpables.push(
            `${nodo.tagName.toLowerCase()}.${(nodo.className || '?').toString().split(' ')[0]}` +
              ` right=${Math.round(caja.right)} w=${Math.round(caja.width)}`,
          );
        }

        // Controles por debajo del mínimo táctil de WCAG 2.2 AA (24×24).
        const pequenos: string[] = [];
        const interactivos = document.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, [role="button"], [role="tab"]',
        );
        for (const nodo of Array.from(interactivos)) {
          const caja = nodo.getBoundingClientRect();
          if (caja.width === 0 || caja.height === 0) continue;
          if (caja.width >= 24 && caja.height >= 24) continue;
          pequenos.push(
            `${nodo.tagName.toLowerCase()}.${(nodo.className || '?').toString().split(' ')[0]}` +
              ` ${Math.round(caja.width)}×${Math.round(caja.height)}`,
          );
        }

        return {
          desborde,
          culpables: Array.from(new Set(culpables)).slice(0, 6),
          pequenos: Array.from(new Set(pequenos)).slice(0, 8),
        };
      });

      if (medida.desborde > 1 || medida.culpables.length || medida.pequenos.length) {
        informe.push({ ruta: route, ancho: width, ...medida });
      }
    }
  }

  writeFileSync(
    'docs/visual-evidence/responsive-audit.json',
    JSON.stringify(informe, null, 2),
    'utf8',
  );
  console.log(`HALLAZGOS: ${informe.length}`);
  console.log(JSON.stringify(informe, null, 2));
});
