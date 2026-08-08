import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Andamiaje del barrido del portal contra el motor REAL.
 *
 * Se entra por la pantalla de acceso con un usuario del proveedor de identidad,
 * no con una sesión forjada. La diferencia importa: la sesión forjada salta el
 * login, el refresco de token y el reparto de roles, que es justo el tramo donde
 * un portal falla de formas que ninguna otra prueba ve.
 *
 * Las credenciales llegan por entorno y **nunca se escriben en el repositorio**:
 *
 *   PW_TENANT_ID=1 PW_USER=<correo> PW_PASSWORD=<clave> PW_BASE_URL=http://localhost:5180 \
 *     yarn playwright test e2e/portal-real.spec.ts
 *
 * Sin ellas la suite se salta entera en vez de fallar: correr contra un motor
 * real es opt-in, y una prueba roja por falta de configuración no informa de
 * ningún defecto.
 */

export const CREDENCIALES = {
  tenantId: process.env.PW_TENANT_ID ?? '1',
  email: process.env.PW_USER ?? '',
  password: process.env.PW_PASSWORD ?? '',
};

export const HAY_CREDENCIALES = CREDENCIALES.email !== '' && CREDENCIALES.password !== '';

/**
 * Entra por la pantalla de acceso, como una persona.
 *
 * Espera al marco del portal y no a una URL: `router.replace` cambia la barra de
 * direcciones antes de que el marco exista, y comprobar la URL daba por buena
 * una sesión que todavía no había pintado nada.
 */
export async function entrar(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  await campoTenant(page).fill(CREDENCIALES.tenantId);
  await campoCorreo(page).fill(CREDENCIALES.email);
  await campoClave(page).fill(CREDENCIALES.password);
  await botonEntrar(page).click();

  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 60_000 });
}

/**
 * Localizadores del formulario de acceso, en un solo sitio.
 *
 * El campo de tenant no tiene `name` ni `autocomplete` —es un `<label>` que
 * envuelve al `<input>`—, así que se localiza por su `inputmode`, que sí es
 * único en esa pantalla. Buscarlo por `name` fallaba en silencio hasta agotar el
 * reloj de la prueba, y el fallo no decía nada del portal.
 */
export function campoTenant(page: Page): Locator {
  return page.locator('.login-form input[inputmode="numeric"]').first();
}

export function campoCorreo(page: Page): Locator {
  return page.locator('.login-form input[autocomplete="username"]').first();
}

export function campoClave(page: Page): Locator {
  return page.locator('.login-form input[autocomplete="current-password"]').first();
}

export function botonEntrar(page: Page): Locator {
  return page.getByRole('button', { name: /iniciar sesión|verificando acceso/i }).first();
}

/** El aviso de fallo del acceso, que el formulario pinta como `role="alert"`. */
export function avisoAcceso(page: Page): Locator {
  return page.locator('.login-problem[role="alert"]').first();
}
