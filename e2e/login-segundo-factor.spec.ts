import { expect, test, type Page, type Route } from '@playwright/test';
import { MOCK_SESSION } from './support/backend-mock';

/**
 * El acceso en DOS pasos, contra un proveedor de identidad simulado que exige segundo factor.
 *
 * Lo que se prueba no es la pantalla del PIN por sí sola —de eso ya se ocupa el spec de
 * componente— sino la costura entera: que una contraseña correcta que devuelve un DESAFÍO no
 * navegue a ninguna vista del portal, que el PIN se canjee contra `/v1/session/login/pin`, y que
 * sólo entonces haya sesión. Ese encadenado es justo el que estaba roto: el motor convertía el
 * desafío en un 501 y el portal lo pintaba como «el servicio de identidad no está disponible».
 */

const DESAFIO = {
  pinChallengeRequired: true,
  challengeToken: 'token-de-desafio-suficientemente-largo',
  expiresInMinutes: 10,
};

const PIN_CORRECTO = '482913';

async function mockIdentityProvider(page: Page): Promise<{ pinRequests: unknown[] }> {
  const pinRequests: unknown[] = [];

  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));

  // Todo lo demás del portal: vacío pero válido, para que la vista de destino monte. Va PRIMERO
  // porque Playwright prueba los interceptores en orden inverso al registro: puesto después, este
  // comodín se tragaba también el login y devolvía una lista vacía donde debía ir la sesión.
  await page.route('**/v1/**', (route) => route.fulfill({ json: { items: [], total: 0 } }));

  await page.route('**/v1/session/**', (route: Route) => {
    const url = route.request().url();

    // La restauración de sesión al abrir la pantalla: sin sesión previa, 401.
    if (url.includes('/refresh')) {
      return route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: 'Sin sesión' } });
    }

    if (url.endsWith('/login/pin')) {
      const body: unknown = route.request().postDataJSON();
      pinRequests.push(body);
      const pin = (body as { pin?: string }).pin;
      if (pin !== PIN_CORRECTO) {
        return route.fulfill({
          status: 401,
          json: { code: 'UNAUTHORIZED', message: 'PIN inválido o expirado.' },
        });
      }
      return route.fulfill({ json: MOCK_SESSION });
    }

    if (url.endsWith('/login')) return route.fulfill({ json: DESAFIO });

    return route.fulfill({ json: { loggedOut: true } });
  });

  return { pinRequests };
}

async function entrarConContrasena(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('ana@atlas.test');
  await page.locator('input[autocomplete="current-password"]').fill('contrasena-correcta');
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();
}

test.describe('acceso con segundo factor', () => {
  test('la contraseña correcta pide el PIN y NO abre sesión todavía', async ({ page }) => {
    await mockIdentityProvider(page);
    await entrarConContrasena(page);

    await expect(page.getByRole('heading', { name: /Revisa tu correo/ })).toBeVisible();
    // El correo se repite en pantalla: es cómo se detecta haber entrado con la cuenta equivocada.
    await expect(page.getByText('ana@atlas.test')).toBeVisible();
    // Sigue en la puerta. Si esto navegara, el portal se creería autenticado sin token.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.sidebar')).toHaveCount(0);
  });

  test('un PIN equivocado explica el código, no las credenciales', async ({ page }) => {
    await mockIdentityProvider(page);
    await entrarConContrasena(page);

    await page.locator('.login-pin-input').fill('000000');
    await page.getByRole('button', { name: /Confirmar acceso/ }).click();

    const aviso = page.getByRole('alert').first();
    await expect(aviso).toContainText(/código no es válido/i);
    await expect(aviso).not.toContainText(/contraseña no coinciden/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('el PIN correcto entra al portal y canjea el token del desafío', async ({ page }) => {
    const { pinRequests } = await mockIdentityProvider(page);
    await entrarConContrasena(page);

    await page.locator('.login-pin-input').fill(PIN_CORRECTO);
    await page.getByRole('button', { name: /Confirmar acceso/ }).click();

    // La primera visita a la vista de destino compila la ruta en el servidor de desarrollo, y eso
    // no cabe en el tiempo por omisión de una aserción.
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 });
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });
    expect(pinRequests).toEqual([{ challengeToken: DESAFIO.challengeToken, pin: PIN_CORRECTO }]);
  });

  test('volver atrás devuelve al formulario de credenciales', async ({ page }) => {
    await mockIdentityProvider(page);
    await entrarConContrasena(page);

    await page.getByRole('button', { name: /Volver e intentar con otra cuenta/ }).click();

    await expect(page.getByRole('heading', { name: /Bienvenido nuevamente/ })).toBeVisible();
    await expect(page.locator('.login-pin-input')).toHaveCount(0);
  });
});
