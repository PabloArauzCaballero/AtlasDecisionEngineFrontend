import { defineConfig, devices } from '@playwright/test';

/**
 * E2E / runtime error-detection config. Drives the real app in Chromium and
 * reuses the dev server already running on :5173 (never boots a second one).
 * Tests live in ./e2e — kept out of src so they never touch the vitest suite,
 * the `tsc -p tsconfig.json` typecheck or the 299-line source gate.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
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
