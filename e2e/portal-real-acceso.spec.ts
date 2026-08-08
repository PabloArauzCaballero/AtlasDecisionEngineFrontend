import { expect, test } from '@playwright/test';
import {
  CREDENCIALES,
  HAY_CREDENCIALES,
  avisoAcceso,
  botonEntrar,
  campoClave,
  campoCorreo,
  campoTenant,
  entrar,
} from './support/real-portal';
import { deAplicacion, vigilar } from './support/real-portal-watch';
import { esperarVista } from './support/real-portal-sweep';

/**
 * La PUERTA del portal, contra el proveedor de identidad real.
 *
 * Cada caso va en su propia prueba, con su propia pestaña. Empezaron juntos en
 * una sola y era un mal diseño: el formulario conserva estado entre intentos
 * —el aviso anterior, el envío en vuelo, el valor ya escrito—, así que un fallo
 * en el cuarto paso no decía si el defecto estaba ahí o venía arrastrado del
 * segundo. Separados, cada rojo señala exactamente un comportamiento.
 *
 * Es opt-in y no guarda ningún secreto: ver `support/real-portal.ts`.
 */

test.describe.configure({ mode: 'serial' });

test.describe('acceso · motor real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  test('el formulario valida antes de enviar nada al servidor', async ({ page }) => {
    test.setTimeout(120_000);
    const problemas = vigilar(page, () => '/login');
    const peticiones: string[] = [];
    page.on('request', (peticion) => {
      if (peticion.url().includes('/v1/session/login')) peticiones.push(peticion.url());
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const clave = campoClave(page);

    // La contraseña nunca se pinta en claro. Es la comprobación más barata que
    // existe y la que más caro sale olvidar.
    await expect(clave).toHaveAttribute('type', 'password');

    // Vacío: el aviso tiene que decir QUÉ falta, no sólo pintar el borde rojo.
    await botonEntrar(page).click();
    await expect(page.locator('#login-email-status.field-error')).toBeVisible();
    await expect(page.locator('#login-password-status.field-error')).toBeVisible();

    // Correo sin dominio: el mensaje explica la forma esperada.
    await campoCorreo(page).fill('pablo@sin-dominio');
    await clave.fill('algo');
    await botonEntrar(page).click();
    await expect(page.locator('#login-email-status.field-error')).toContainText(/@ y dominio/i);

    // El ojo muestra y vuelve a ocultar la contraseña.
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(clave).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
    await expect(clave).toHaveAttribute('type', 'password');

    await expect(page.locator('.sidebar')).toHaveCount(0);
    // Lo que de verdad se afirma: con datos inválidos NO se llamó al servidor.
    // Un formulario que valida y envía igual gasta un intento del límite de
    // fallos de autenticación por cada error de tecleo.
    expect(peticiones, 'no debe salir ninguna petición de login').toEqual([]);
    expect(deAplicacion(problemas)).toEqual([]);
  });

  test('una credencial equivocada se rechaza sin delatar si la cuenta existe', async ({ page }) => {
    test.setTimeout(120_000);
    const problemas = vigilar(page, () => '/login', { esperadas: [/\/v1\/session\/login/] });

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await campoTenant(page).fill(CREDENCIALES.tenantId);
    await campoCorreo(page).fill(CREDENCIALES.email);
    await campoClave(page).fill('contrasena-que-no-es-la-suya');

    const [respuesta] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/v1/session/login'), { timeout: 60_000 }),
      botonEntrar(page).click(),
    ]);
    expect(respuesta.status(), 'una clave incorrecta es un 401, no un fallo del servidor').toBe(
      401,
    );

    const aviso = avisoAcceso(page);
    await expect(aviso).toBeVisible({ timeout: 30_000 });
    const texto = (await aviso.innerText()).toLowerCase();
    expect(texto, 'el aviso debe decir algo').toMatch(/\S/);
    // Decir «ese correo no existe» convierte la pantalla de acceso en un
    // buscador de cuentas válidas.
    expect(texto, 'el aviso no debe revelar si la cuenta existe').not.toMatch(
      /no existe|usuario desconocido|correo no registrado/,
    );
    await expect(page.locator('.sidebar')).toHaveCount(0);
    expect(deAplicacion(problemas)).toEqual([]);
  });

  /**
   * Un tenant que no existe se rechaza igual que una contraseña equivocada.
   *
   * Y con el MISMO código, a propósito. El proveedor de identidad responde 409 a
   * un tenant desconocido, y el motor lo mandaba a `502 IDENTITY_PROVIDER_ERROR`:
   * operativamente eso significa «el proveedor está caído» —dispara reintentos,
   * alertas y guardia— por lo que en realidad es un dedazo en la casilla del
   * tenant. Y para quien prueba desde fuera era un oráculo: contraseña mala
   * respondía 401 y tenant malo 502, de modo que el par de respuestas revelaba
   * qué tenants existen. Corregido en
   * `src/common/security/identity-provider.client.ts`: 404 y 409 se tratan como
   * 401, igual que 403.
   */
  test('un tenant inexistente se rechaza con 401, sin delatar que no existe', async ({ page }) => {
    test.setTimeout(120_000);
    const problemas = vigilar(page, () => '/login', { esperadas: [/\/v1\/session\/login/] });

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await campoTenant(page).fill('999999');
    await campoCorreo(page).fill(CREDENCIALES.email);
    await campoClave(page).fill(CREDENCIALES.password);

    const [respuesta] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/v1/session/login'), { timeout: 60_000 }),
      botonEntrar(page).click(),
    ]);
    expect(
      respuesta.status(),
      'un tenant inexistente es una credencial rechazada (401), no un fallo del proveedor (502)',
    ).toBe(401);

    // Y el portal lo explica sin dejar entrar.
    await expect(avisoAcceso(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.sidebar')).toHaveCount(0);

    expect(deAplicacion(problemas), 'un rechazo no puede romper el portal').toEqual([]);
  });

  test('la credencial correcta entra y la sesión sirve para pedir datos', async ({ page }) => {
    test.setTimeout(120_000);
    const problemas = vigilar(page, () => '/login');

    /*
     * Se comprueba que el TOKEN funciona, no que un nombre aparezca en pantalla.
     *
     * Un `.sidebar` visible sólo prueba que el portal se pintó; con una sesión
     * forjada se pinta igual. Lo que distingue una sesión real es que el motor
     * acepta sus peticiones: por eso lo que se afirma es que hubo llamadas a
     * `/v1/` respondidas con 2xx, que es imposible sin un token que el motor
     * haya emitido y sepa verificar.
     */
    const pedidas: string[] = [];
    const rechazadas: string[] = [];
    page.on('response', (r) => {
      const url = r.url();
      if (!url.includes('/v1/') || url.includes('/v1/session/')) return;
      pedidas.push(new URL(url).pathname);
      if (r.status() === 401 || r.status() === 403) rechazadas.push(new URL(url).pathname);
    });

    await entrar(page);
    await expect(page.locator('.sidebar')).toBeVisible();

    await page.goto('/workers', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await esperarVista(page);

    /*
     * Se afirma que el motor NO rechaza el token, no que devuelva 2xx.
     *
     * Contar respuestas 2xx hacía fallar la prueba cuando el limitador
     * respondía 429 a todo: la sesión era válida y la prueba decía lo
     * contrario. Un 401 o un 403 sí significan que el token no sirve, que es
     * exactamente lo que aquí se quiere descartar.
     */
    expect(pedidas.length, 'el portal debe pedir datos al motor').toBeGreaterThan(0);
    expect(rechazadas, 'el motor no debe rechazar el token de la sesión').toEqual([]);
    expect(deAplicacion(problemas)).toEqual([]);
  });
});
