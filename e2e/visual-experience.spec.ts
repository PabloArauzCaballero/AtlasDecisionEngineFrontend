import { expect, test } from '@playwright/test';
import { collectProblems, mockBackend } from './support/backend-mock';

/**
 * Recorridos visuales del acceso y del panel de inicio.
 *
 * Comprueban lo que una prueba de componente no ve: composición real en
 * escritorio y móvil, que el fondo animado no se interponga entre el usuario y
 * el formulario, y que no haya errores de hidratación en las pantallas nuevas.
 */

test('el acceso se compone en dos zonas y el fondo no bloquea el formulario', async ({ page }) => {
  const problems = collectProblems(page);
  await mockBackend(page, { loginStatus: 401 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: /Bienvenido nuevamente/ })).toBeVisible();
  await expect(page.locator('.login-showcase')).toBeVisible();
  await expect(page.locator('.login-graph')).toBeVisible();
  await expect(page.locator('.login-highlights li')).toHaveCount(5);

  // El fondo cubre la pantalla: si capturase el puntero, escribir sería imposible.
  await expect(page.locator('.ambient-bg')).toHaveCount(1);
  await page.locator('input[autocomplete="username"]').click();
  await page.keyboard.type('usuario@empresa.com');
  await expect(page.locator('input[autocomplete="username"]')).toHaveValue('usuario@empresa.com');

  expect(problems, problems.join('\n')).toEqual([]);
});

test('el acceso se simplifica en móvil sin perder identidad', async ({ page }) => {
  await mockBackend(page, { loginStatus: 401 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: /Bienvenido nuevamente/ })).toBeVisible();
  await expect(page.locator('.login-identity')).toBeVisible();
  await expect(page.locator('.login-graph')).toBeHidden();
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();

  // Nada debe desbordar horizontalmente en un teléfono estrecho.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('mostrar y ocultar contraseña funciona en el navegador real', async ({ page }) => {
  // Sin sesión y con el formulario ya montado: si se comprobara el campo antes
  // de que el acceso termine de resolver la sesión, la prueba dependería de lo
  // rápido que responda el servidor de desarrollo.
  await mockBackend(page, { loginStatus: 401 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Bienvenido nuevamente/ })).toBeVisible();
  const password = page.locator('input[autocomplete="current-password"]');

  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('las credenciales incorrectas se explican sin códigos HTTP', async ({ page }) => {
  await mockBackend(page, { loginStatus: 401 });
  await page.goto('/login');

  await page.locator('input[autocomplete="username"]').fill('usuario@empresa.com');
  await page.locator('input[autocomplete="current-password"]').fill('mala');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Se acota al aviso del acceso: el anunciador de rutas de Next.js también
  // expone `role="alert"` y haría ambigua la búsqueda por rol.
  const alert = page.locator('[role="alert"].login-problem');
  await expect(alert).toContainText('No pudimos iniciar tu sesión');
  await expect(alert).toContainText('no coinciden con una cuenta activa');
  await expect(alert).not.toContainText('401');
});

test('la reducción de movimiento apaga el fondo animado', async ({ page }) => {
  await mockBackend(page, { loginStatus: 401 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');

  await expect(page.locator('.ambient-bg')).toHaveClass(/is-static/);
  // La información sigue estando toda disponible sin animación.
  await expect(page.locator('.login-rotator')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});

test('el panel de inicio muestra números reales del backend y accesos rápidos', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = collectProblems(page);
  await mockBackend(page);

  await page.goto('/platform-health', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.dash-grid')).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText('Artefactos de decisión')).toBeVisible();
  await expect(page.locator('.dash-card').first()).toContainText('12');
  await expect(page.getByText('Ejecuciones registradas')).toBeVisible();
  // Una ejecución fallida en la lista debe aparecer como trabajo a revisar.
  await expect(page.locator('.dash-attention li')).toHaveCount(1);
  await expect(page.locator('.dash-shortcut')).toHaveCount(6);

  expect(problems, problems.join('\n')).toEqual([]);
});
