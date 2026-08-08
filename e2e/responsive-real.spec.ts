import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AUDIT_ROUTES, AUDIT_WIDTHS } from './support/responsive-matrix';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';
import { esperarVista } from './support/real-portal-sweep';
import { MEDIDA_DESBORDE, type MedidaResponsive } from './support/real-portal-review';

/**
 * Evidencia responsive de TODO el portal, con datos reales.
 *
 * La auditoría que ya existía (`responsive-audit.spec.ts`) mide contra el motor
 * simulado denso. Sirve, pero mide una aproximación: los anchos de columna, los
 * saltos de línea y los desbordes dependen del contenido, y el contenido real
 * —códigos largos, glosas de banco, rutas de árbol de categorías— no es el que
 * inventa un simulado. Ésta recorre la MISMA matriz con la sesión real.
 *
 * Deja dos cosas en `docs/visual-evidence/real/`:
 *
 *   - `responsive-real.json`  — la medición, ruta por ruta y ancho por ancho.
 *   - `<ruta>@<ancho>.png`    — la captura, para mirarla cuando el número no basta.
 *
 * **No afirma sobre la matriz completa.** Recorre 43 rutas × 10 anchos y su
 * trabajo es dejar constancia; quien bloquea la entrega es `responsive.spec.ts`
 * sobre el subconjunto del gate. Lo único que sí exige aquí es que la corrida
 * complete: una evidencia a medias se lee como una evidencia.
 */

const CARPETA = 'docs/visual-evidence/real';

interface Hallazgo {
  ruta: string;
  ancho: number;
  desborde?: number;
  culpables?: string[];
  pequenos?: string[];
  error?: string;
}

function nombreArchivo(ruta: string, ancho: number): string {
  const limpia = ruta.replace(/^\//, '').replace(/\//g, '_') || 'raiz';
  return `${CARPETA}/${limpia}@${ancho}.png`;
}

test.describe('evidencia responsive · portal real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  test('matriz completa: 43 rutas × 10 anchos, con capturas', async ({ page }) => {
    test.setTimeout(90 * 60_000);
    mkdirSync(CARPETA, { recursive: true });

    const hallazgos: Hallazgo[] = [];
    let capturas = 0;

    /*
     * El informe se escribe pase lo que pase, igual que en la auditoría con el
     * motor simulado: si el barrido muere a mitad, un JSON de la corrida
     * anterior se leería como vigente y sus hallazgos como actuales.
     */
    const volcar = () => {
      writeFileSync(
        `${CARPETA}/responsive-real.json`,
        JSON.stringify(
          {
            generadoEn: new Date().toISOString(),
            fuente: 'motor real, sesión real',
            rutas: AUDIT_ROUTES.length,
            anchos: AUDIT_WIDTHS,
            capturas,
            hallazgos,
          },
          null,
          2,
        ),
      );
    };

    try {
      /*
       * `/login` se captura ANTES de entrar, y es el único que se captura sin
       * sesión: con una sesión activa el portal redirige al panel, así que la
       * pantalla de acceso sólo existe mientras no se ha entrado.
       */
      await page.setViewportSize({ width: 1280, height: 900 });
      for (const ancho of AUDIT_WIDTHS) {
        await page.setViewportSize({ width: ancho, height: 900 });
        await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.locator('.login-page').first().waitFor({ state: 'visible', timeout: 60_000 });
        await page.waitForTimeout(300);
        const medida = (await page.evaluate(MEDIDA_DESBORDE)) as MedidaResponsive;
        hallazgos.push({ ruta: '/login', ancho, ...medida });
        await page.screenshot({ path: nombreArchivo('/login', ancho), fullPage: true });
        capturas += 1;
        volcar();
      }

      await page.setViewportSize({ width: 1280, height: 900 });
      await entrar(page);

      /*
       * UNA carga por ruta, y los diez anchos dentro de ella.
       *
       * Antes se recargaba por celda: 440 navegaciones completas, cada una
       * forzando un refresco de sesión. El limitador del motor tumbaba parte de
       * esos refrescos, el guard redirigía a `/login` y la evidencia acababa
       * llena de capturas del formulario de acceso rotuladas como si fueran
       * vistas del portal —135 de 440 en la última corrida—.
       *
       * Con una sola carga por ruta son 43, y además se mide lo que se quiere
       * medir: cómo se REORGANIZA una vista ya montada al cambiar el ancho, que
       * es lo que le pasa a una ventana que alguien redimensiona. Lo que esto no
       * ejercita es el primer render en cada ancho; para eso está la auditoría
       * contra el motor simulado, que sí puede recargar sin coste.
       */
      for (const ruta of AUDIT_ROUTES) {
        if (ruta === '/login') continue;

        try {
          await page
            .goto(ruta, { waitUntil: 'domcontentloaded', timeout: 60_000 })
            .catch(async () => {
              // Un parpadeo de red del anfitrión no puede invalidar la corrida.
              await page.waitForTimeout(3_000);
              return page.goto(ruta, { waitUntil: 'domcontentloaded', timeout: 60_000 });
            });

          let estado = await esperarVista(page);
          if (estado === 'sesion-perdida') {
            await entrar(page);
            await page.goto(ruta, { waitUntil: 'domcontentloaded', timeout: 60_000 });
            estado = await esperarVista(page);
          }

          const rutaFinal = new URL(page.url()).pathname;
          if (estado !== 'lista' || rutaFinal !== ruta) {
            // La ruta entera se anota como fallida: sin la vista montada no hay
            // ningún ancho que medir.
            for (const ancho of AUDIT_WIDTHS) {
              hallazgos.push({
                ruta,
                ancho,
                error:
                  rutaFinal === ruta
                    ? `la vista no se asentó (${estado})`
                    : `acabó en ${rutaFinal} en vez de en su ruta`,
              });
            }
            volcar();
            continue;
          }

          for (const ancho of AUDIT_WIDTHS) {
            await page.setViewportSize({ width: ancho, height: 900 });
            // Que el navegador aplique las media queries y React reaccione al
            // `resize` antes de medir.
            await page.waitForTimeout(400);

            const medida = (await page.evaluate(MEDIDA_DESBORDE)) as MedidaResponsive;
            hallazgos.push({ ruta, ancho, ...medida });
            await page.screenshot({ path: nombreArchivo(ruta, ancho), fullPage: true });
            capturas += 1;
            volcar();
          }
        } catch (error) {
          for (const ancho of AUDIT_WIDTHS) {
            hallazgos.push({ ruta, ancho, error: (error as Error).message.slice(0, 200) });
          }
          volcar();
        }
      }
    } finally {
      volcar();
    }

    const conDesborde = hallazgos.filter((h) => (h.desborde ?? 0) > 1);
    const conError = hallazgos.filter((h) => h.error !== undefined);

    console.log(`\n  capturas: ${capturas} de ${AUDIT_ROUTES.length * AUDIT_WIDTHS.length}`);
    console.log(`  celdas con desborde horizontal: ${conDesborde.length}`);
    for (const h of conDesborde.slice(0, 40)) {
      console.log(
        `    ${h.ruta} @ ${h.ancho}px → ${h.desborde}px · ${(h.culpables ?? []).join('; ')}`,
      );
    }
    console.log(`  celdas que fallaron al medirse: ${conError.length}`);
    for (const h of conError.slice(0, 20)) console.log(`    ${h.ruta} @ ${h.ancho}px → ${h.error}`);
    console.log(`\n  informe: ${CARPETA}/responsive-real.json\n`);

    // Lo único que se afirma: la evidencia está completa. Sin esto, una corrida
    // que midió tres rutas y murió dejaría un informe que parece un barrido.
    expect(conError, 'celdas que no se pudieron medir').toEqual([]);
    expect(capturas).toBe(AUDIT_ROUTES.length * AUDIT_WIDTHS.length);
  });
});
