import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { denseBackend } from './support/dense-backend';

/**
 * Evidencia visual responsive.
 *
 * Deja en `docs/visual-evidence/responsive/` una captura por ruta y ancho, con
 * los datos densos puestos: una vista vacía sale igual de bien a cualquier
 * tamaño y no demuestra nada. Es una herramienta, no una prueba — no afirma
 * nada, sirve para mirar.
 *
 * `yarn test:e2e:tools --grep "capturas responsive"`
 */

const SALIDA = 'docs/visual-evidence/responsive';

/** Una vista por familia estructural, no una por ruta: lo que se compara es la
 *  organización, y las 41 rutas repiten seis organizaciones. */
const RUTAS = [
  { ruta: '/platform-health', nombre: 'panel' },
  { ruta: '/variables', nombre: 'tabla-densa' },
  { ruta: '/test-cases', nombre: 'filtros-y-tabla' },
  { ruta: '/executions/1', nombre: 'detalle-dos-columnas' },
  { ruta: '/simulator', nombre: 'formulario' },
  { ruta: '/login', nombre: 'autenticacion' },
] as const;

/** Los tres cortes de la escala, más el equivalente a zoom del 200 %. */
const ANCHOS = [
  { ancho: 320, alto: 800, nombre: '320-movil' },
  { ancho: 640, alto: 512, nombre: '640-zoom200' },
  { ancho: 768, alto: 1024, nombre: '768-tableta' },
  { ancho: 1280, alto: 900, nombre: '1280-portatil' },
] as const;

test('capturas responsive de la matriz', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  mkdirSync(SALIDA, { recursive: true });
  await denseBackend(page);

  for (const { ancho, alto, nombre: sufijo } of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: alto });
    for (const { ruta, nombre } of RUTAS) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      /*
       * `animations: 'disabled'` adelanta las animaciones de entrada a su
       * fotograma final. Sin ello la captura las reinicia y, como se declaran
       * con `both`, las congela en opacidad cero: los paneles salen en blanco y
       * parecen un fallo de la interfaz.
       */
      await page.screenshot({
        path: `${SALIDA}/${sufijo}--${nombre}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
  console.log(`Capturas en ${SALIDA}: ${ANCHOS.length * RUTAS.length}`);
});
