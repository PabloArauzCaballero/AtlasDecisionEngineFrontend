import { expect, test } from '@playwright/test';
import { collectProblems } from './support/backend-mock';
import { mockWorkersBackend } from './support/workers-backend';

/**
 * Tomar la selfie con la cámara del equipo.
 *
 * Vive en su propio archivo porque `launchOptions` no se puede declarar dentro
 * de un `describe` —Playwright lo rechaza: obliga a un worker nuevo— y estas
 * pruebas necesitan arrancar Chromium con la cámara falsa.
 *
 * `--use-fake-device-for-media-capture` entrega un patrón de vídeo y
 * `--use-fake-ui-for-media-stream` acepta el permiso sin diálogo del sistema.
 * Con eso esto NO es un simulado de la función: el navegador abre un
 * `MediaStream` de verdad, el `<video>` lo reproduce y el lienzo lee sus
 * píxeles. Lo único fingido debería ser el sensor.
 *
 * **Esta prueba NO deja capturas.** Se intentó, y salió la habitación de quien
 * la ejecutaba: en esta máquina Chromium abrió la cámara REAL pese a las
 * banderas, así que una captura del diálogo con vídeo en vivo habría versionado
 * la cara de alguien en el historial de git para siempre. Lo que hay que
 * comprobar aquí se comprueba con aserciones —hay `MediaStream`, el lienzo
 * captura, el archivo entra en el formulario y las pistas se apagan—, y nada de
 * eso necesita una foto.
 */

const RUTA = '/workers/identity-verification';

test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-capture', '--use-fake-ui-for-media-stream'],
  },
  permissions: ['camera'],
});

test.describe('tomar la selfie con la cámara', () => {
  test('la foto tomada entra en el formulario como un archivo más', async ({ page }) => {
    const problemas = collectProblems(page);
    await mockWorkersBackend(page);
    await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await page.getByRole('tab', { name: 'Consola' }).click();
    const consola = page.locator('.worker-console');
    await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });
    await consola.getByRole('radio', { name: /Cargar mis propias imágenes/i }).check();

    // El botón vive SÓLO en la selfie: el documento hay que fotografiarlo con
    // algo que se pueda mover alrededor de la tarjeta, no con la webcam.
    await expect(consola.getByRole('button', { name: /Tomar con la cámara/i })).toHaveCount(1);
    await consola.getByRole('button', { name: /Tomar con la cámara/i }).click();

    const dialogo = page.getByRole('dialog', { name: /Tomar la selfie/i });
    await expect(dialogo).toBeVisible();

    // «Tomar foto» sólo se habilita cuando hay imagen de verdad: mientras el
    // navegador pide permiso, pulsarlo capturaría un lienzo en blanco.
    const tomar = dialogo.getByRole('button', { name: 'Tomar foto' });
    await expect(tomar).toBeEnabled({ timeout: 30_000 });
    await expect(dialogo.locator('.camera-video')).toBeVisible();
    await tomar.click();

    // Congelada: hay que aceptarla, y se puede repetir.
    await expect(dialogo.locator('.camera-canvas')).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Repetir' })).toBeVisible();
    await dialogo.getByRole('button', { name: 'Usar esta foto' }).click();

    // El diálogo se cierra y la foto queda en el campo, con su vista previa y
    // su tamaño: exactamente igual que si se hubiera subido un archivo.
    await expect(dialogo).toHaveCount(0);
    const selfie = consola.locator('.identity-image-field').filter({ hasText: 'Selfie' });
    await expect(selfie.locator('.identity-image-preview')).toBeVisible();
    await expect(selfie.getByText(/^selfie-\d+\.jpg$/)).toBeVisible();

    expect(problemas, `problemas de consola: ${problemas.join(' | ')}`).toEqual([]);
  });

  test('cancelar no deja la cámara encendida ni ensucia el formulario', async ({ page }) => {
    /*
     * Se envuelve `getUserMedia` ANTES de navegar para quedarse con los
     * `MediaStream` que la página abra. Es la única forma de comprobar desde
     * fuera que la cámara se apagó: en la pantalla no se ve, y un `stop()`
     * que se pierda en una refactorización deja el testigo del portátil
     * encendido sin que ninguna prueba lo note.
     */
    await page.addInitScript(() => {
      const registro: MediaStream[] = [];
      (window as unknown as { __camaras: MediaStream[] }).__camaras = registro;
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (restricciones) => {
        const stream = await original(restricciones);
        registro.push(stream);
        return stream;
      };
    });

    await mockWorkersBackend(page);
    await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('tab', { name: 'Consola' }).click();
    const consola = page.locator('.worker-console');
    await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });
    await consola.getByRole('radio', { name: /Cargar mis propias imágenes/i }).check();
    await consola.getByRole('button', { name: /Tomar con la cámara/i }).click();

    const dialogo = page.getByRole('dialog', { name: /Tomar la selfie/i });
    await expect(dialogo.getByRole('button', { name: 'Tomar foto' })).toBeEnabled({
      timeout: 30_000,
    });
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toHaveCount(0);

    // Ni una sola pista viva: la cámara quedó apagada de verdad.
    const vivas = await page.evaluate(() => {
      const abiertas = (window as unknown as { __camaras?: MediaStream[] }).__camaras ?? [];
      return abiertas
        .flatMap((stream) => stream.getTracks())
        .filter((track) => track.readyState === 'live').length;
    });
    expect(vivas, 'quedaron pistas de cámara sin detener').toBe(0);
    // Y se abrió alguna: si no, la comprobación de arriba pasaría por vacío.
    const abiertas = await page.evaluate(
      () => ((window as unknown as { __camaras?: MediaStream[] }).__camaras ?? []).length,
    );
    expect(abiertas, 'la cámara ni siquiera llegó a abrirse').toBeGreaterThan(0);
    await expect(consola.locator('.identity-image-preview')).toHaveCount(0);
  });
});
