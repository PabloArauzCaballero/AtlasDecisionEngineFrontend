import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      ['/v1', '/health', '/metrics'].map((path) => [
        path,
        {
          target: 'http://localhost:3000',
          changeOrigin: false,
        },
      ]),
    ),
  },
  preview: { port: 4173, strictPort: true },
  build: { sourcemap: true, target: 'es2022' },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts' },
});
