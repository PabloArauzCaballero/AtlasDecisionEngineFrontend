import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Unit/component suite lives in src; Playwright specs in e2e/ are driven by
    // `yarn test:e2e`, never by vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
