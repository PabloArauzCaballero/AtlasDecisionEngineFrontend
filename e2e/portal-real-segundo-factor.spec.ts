import { expect, test } from '@playwright/test';
import { CREDENCIALES, HAY_CREDENCIALES, entrar } from './support/real-portal';
import { HAY_BUZON } from './support/buzon-pin';

/**
 * El acceso de dos pasos contra el proveedor de identidad REAL.
 *
 * Los otros `portal-real-*` usan `entrar()` para llegar a la vista que quieren probar; éste prueba
 * `entrar()` mismo, que es el único tramo donde intervienen a la vez los tres servicios: el portal
 * pide el PIN, el motor canjea el desafío y el proveedor emite y verifica el código que mandó por
 * correo. Ninguna prueba con el motor simulado puede afirmar eso.
 *
 * Necesita el recolector de correo (`PW_PIN_INBOX_PORT`) porque el PIN sale por donde saldría en
 * producción y hay que leerlo de ahí. Sin él se salta, igual que sin credenciales: apagar el
 * segundo factor para que pase dejaría la prueba en verde sin haber probado lo que dice probar.
 */
test.describe('acceso real con segundo factor', () => {
  test.skip(!HAY_CREDENCIALES, 'Configura PW_USER / PW_PASSWORD para correr contra el motor real.');
  test.skip(!HAY_BUZON, 'Configura PW_PIN_INBOX_PORT y NOTIFICATION_EMAIL_PROVIDER=webhook.');

  test('la contraseña y el PIN del correo abren la sesión', async ({ page }) => {
    test.setTimeout(180_000);

    await entrar(page);

    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  /*
   * El aviso que motivó todo esto. Se comprueba DESPUÉS de un acceso con PIN de verdad: mientras el
   * proveedor publicaba la columna `mfa_enabled` —que nadie escribe para cuentas internas— salía
   * aquí, afirmando que la cuenta no tenía segundo factor justo después de exigirle uno.
   */
  test('el portal ya no dice que esta cuenta no tiene segundo factor', async ({ page }) => {
    test.setTimeout(180_000);

    await entrar(page);

    await expect(page.getByText(/sólo con contraseña|no tiene segundo factor/i)).toHaveCount(0);
    // La cuenta usada es la de pruebas, no la del dueño del entorno.
    expect(CREDENCIALES.email).not.toBe('');
  });
});
