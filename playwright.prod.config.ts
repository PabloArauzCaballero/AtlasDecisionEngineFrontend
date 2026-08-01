import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * La misma suite, contra el artefacto que de verdad se despliega.
 *
 * El servidor de desarrollo compila cada ruta la primera vez que se pide, así
 * que un barrido de dos docenas de vistas se pasa la mayor parte del tiempo
 * esperando a Turbopack. Eso obliga a presupuestos de minutos y hace que un
 * fallo por reloj se parezca demasiado a un fallo de verdad.
 *
 * Aquí no hay compilación al vuelo: todo está construido. Además se ejercita lo
 * que se publica —CSP sin `'unsafe-eval'`, código minificado, React en modo
 * producción—, que es donde importa que las cosas funcionen.
 *
 *   yarn build && yarn test:e2e:prod
 */
export default defineConfig({
  ...base,
  // Sin compilación al vuelo, cualquier cosa que tarde un minuto está colgada.
  timeout: 60_000,
  webServer: {
    command: 'node scripts/serve-standalone.mjs',
    url: process.env.PW_BASE_URL ?? 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
