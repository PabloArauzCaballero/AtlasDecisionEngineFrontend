import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { EVIDENCIA, capturar, panelDeIdentidad, vigilar } from './support/identidad-real';
import { fotoLisa, pngDeRuido } from './support/imagen-sintetica';
import { cedulaConRetrato, selfieSintetica } from './support/rostro-sintetico';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';

/**
 * Subir imágenes propias, contra el motor real.
 *
 * Es el camino que de verdad usa una persona y el único donde se ejercitan el
 * `multipart/form-data`, los bytes mágicos, el techo de tamaño y la LECTURA del
 * documento. Elegir un escenario del catálogo no toca nada de eso.
 *
 * Las dos caras de la misma moneda viven juntas a propósito: un documento
 * legible termina con veredicto, y una foto cualquiera se rechaza. Separadas,
 * es fácil endurecer una y ablandar la otra sin notarlo.
 *
 * Vive aparte de `portal-real-identidad.spec.ts` por el límite de 299 líneas.
 */

test.describe.configure({ mode: 'serial' });

test.describe('verificación de identidad · imágenes propias', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  test.beforeAll(() => {
    mkdirSync(EVIDENCIA, { recursive: true });
  });

  test('subir dos imágenes propias recorre el camino completo', async ({ page }) => {
    /*
     * El camino que de verdad usa una persona, y el único donde se ejercitan el
     * `multipart/form-data`, los bytes mágicos, el techo de tamaño y el límite
     * de resolución. Elegir un escenario del catálogo no toca nada de eso.
     *
     * Las imágenes se generan aquí —ruido determinista— porque una foto real de
     * un documento real es exactamente el dato que este worker existe para
     * proteger: versionarla la publicaría en el historial para siempre.
     */
    test.setTimeout(6 * 60_000);
    const { red } = vigilar(page);
    await entrar(page);
    await page.goto('/workers/identity-verification', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    const mio = panelDeIdentidad(page);
    await mio.getByRole('tab', { name: 'Consola' }).click();
    const consola = mio.locator('.worker-console');
    await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 60_000 });

    await consola.getByRole('radio', { name: /Cargar mis propias imágenes/i }).check();
    // Una marca de tiempo en la semilla: sin ella, la segunda corrida manda las
    // mismas imágenes, el motor deduplica por huella y devuelve la verificación
    // vieja — verde sin haber procesado nada.
    const sello = Date.now().toString(36);
    // La MISMA persona en el documento y en la selfie: con biometría real, dos
    // caras distintas darían un rechazo por no parecerse, que aquí no es lo que
    // se quiere probar.
    const semilla = Date.now() % 100000;
    await consola
      .locator('#identity-document-label')
      .locator('..')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'documento.png',
        mimeType: 'image/png',
        // Una cédula LEGIBLE: el motor lee el documento de verdad, así que una
        // imagen de ruido ya no vale como documento — y ésa es justamente la
        // otra prueba de este archivo.
        buffer: await cedulaConRetrato(
          page,
          sello.replace(/\D/g, '').padEnd(7, '4').slice(0, 7),
          semilla,
        ),
      });
    await consola
      .locator('#identity-selfie-label')
      .locator('..')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'selfie.png',
        mimeType: 'image/png',
        buffer: await selfieSintetica(page, semilla),
      });

    // La vista previa: es lo único que permite a alguien comprobar que no
    // confundió las dos fotos antes de mandarlas.
    await expect(consola.locator('.identity-image-preview')).toHaveCount(2);
    await capturar(page, '10-imagenes-propias');

    await consola.getByRole('button', { name: 'Verificar' }).click();
    const veredicto = consola.locator('.identity-result');
    await expect(veredicto).toBeVisible({ timeout: 4 * 60_000 });
    // El veredicto concreto depende de la calibración del despliegue; lo que
    // esta prueba fija es que HAY veredicto y que trae su evidencia.
    await expect(veredicto.locator('.identity-evidence')).toBeVisible();
    await capturar(page, '11-veredicto-imagenes-propias');

    expect(red, `respuestas con error: ${red.join(' | ')}`).toEqual([]);
  });

  test('una imagen cualquiera se rechaza, y la pantalla dice por qué', async ({ page }) => {
    /*
     * El defecto que motivó todo esto: con un lector simulado, subir una foto
     * cualquiera terminaba en VERIFICADO. Ahora el documento se lee de verdad,
     * y sin letras no hay documento.
     *
     * Se afirma sobre la PANTALLA y no sobre la respuesta HTTP: lo que importa
     * es que quien subió la foto entienda qué pasó y qué hacer, no que el
     * motor devolviera el código correcto.
     */
    test.setTimeout(6 * 60_000);
    await entrar(page);
    await page.goto('/workers/identity-verification', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    const mio = panelDeIdentidad(page);
    await mio.getByRole('tab', { name: 'Consola' }).click();
    const consola = mio.locator('.worker-console');
    await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 60_000 });
    await consola.getByRole('radio', { name: /Cargar mis propias imágenes/i }).check();

    const sello = Date.now().toString(36);
    await consola
      .locator('#identity-document-label')
      .locator('..')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'foto-cualquiera.png',
        mimeType: 'image/png',
        buffer: await fotoLisa(page),
      });
    await consola
      .locator('#identity-selfie-label')
      .locator('..')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'selfie.png',
        mimeType: 'image/png',
        buffer: pngDeRuido(640, 640, `selfie-${sello}`),
      });
    await consola.getByRole('button', { name: 'Verificar' }).click();

    // Termina en FALLO, no en veredicto: no hay identidad que discutir.
    await expect(consola.getByText('Falló')).toBeVisible({ timeout: 4 * 60_000 });
    await expect(consola.getByText(/no se pudo leer ningún texto/i)).toBeVisible();
    await expect(
      consola.locator('code', { hasText: 'IDENTITY_DOCUMENT_UNSUPPORTED' }),
    ).toBeVisible();
    // Y no se pinta ningún veredicto: sería afirmar algo sobre una persona a
    // partir de una foto que no es un documento.
    await expect(consola.locator('.identity-result')).toHaveCount(0);
    await capturar(page, '13-imagen-cualquiera-rechazada');
  });
});
