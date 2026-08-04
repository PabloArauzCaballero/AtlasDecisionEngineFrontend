import { defineConfig, devices } from '@playwright/test';

/**
 * E2E / runtime error-detection config. Drives the real app in Chromium and
 * reuses the dev server already running on :5173 (never boots a second one).
 * Tests live in ./e2e — kept out of src so they never touch the vitest suite,
 * the `tsc -p tsconfig.json` typecheck or the 299-line source gate.
 */
/**
 * Especificaciones que NO son pruebas: generan material (capturas, huellas de
 * estilo) y no afirman nada. Tardan minutos y su resultado no dice si el código
 * está bien, así que se quedan fuera de la corrida normal y se piden a mano con
 * `yarn test:e2e:tools`. Dejarlas dentro sólo enseñaba a esperar —o a saltarse—
 * una suite lenta, que es la forma más rápida de que nadie la corra.
 */
export const ON_DEMAND = [
  '**/visual-evidence.spec.ts',
  '**/style-fingerprint.spec.ts',
  '**/responsive-audit.spec.ts',
];

export default defineConfig({
  testDir: './e2e',
  testIgnore: ON_DEMAND,
  /*
   * 30 s no daban. En desarrollo, Turbopack compila cada ruta la primera vez que
   * se pide, y basta tocar una hoja de estilos para que la siguiente prueba que
   * entre pague la recompilación entera: la que llegaba primera fallaba por reloj
   * y no por defecto, que es la peor clase de prueba inestable — enseña a
   * reintentar en vez de a mirar. El arranque del servidor ya asumía lo mismo
   * con sus 300 s.
   */
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  /*
   * Un solo worker, y no por prudencia: por medida.
   *
   * Toda la suite ataca UN servidor Next. Repartirla entre varios navegadores no
   * multiplica el rendimiento —el cuello de botella es el servidor, que es uno—, sólo
   * añade contención: los `page.goto` empiezan a agotar su minuto y el barrido falla en
   * rutas distintas en cada corrida, que es la peor clase de prueba inestable porque
   * enseña a reintentar en vez de a mirar.
   *
   * La misma suite contra el mismo artefacto construido: en paralelo, 8 fallos en 25,8
   * min; en serie, 26 pruebas en verde en 6,3 min. El paralelismo aquí es cuatro veces
   * más lento Y menos fiable. Playwright ya usa 1 worker en CI por omisión; esto extiende
   * ese criterio al puesto de trabajo, donde además compite con el resto de la máquina.
   */
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: {
    baseURL: process.env.PW_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'yarn dev',
    url: process.env.PW_BASE_URL ?? 'http://localhost:5173',
    reuseExistingServer: true,
    // Dev-mode Turbopack cold-compiles the whole app on first boot; give it room
    // on a loaded machine so the suite doesn't fail before it even starts.
    timeout: 300_000,
  },
});
