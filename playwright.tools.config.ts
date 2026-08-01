import { defineConfig } from '@playwright/test';
import base, { ON_DEMAND } from './playwright.config';

/**
 * Las herramientas, no las pruebas.
 *
 * `visual-evidence` deja capturas en `docs/visual-evidence/` y
 * `style-fingerprint` anota los estilos ya calculados para comparar un antes y
 * un después al refactorizar CSS. Ninguna afirma nada, así que no pintan nada en
 * la corrida normal — pero cuando hacen falta, hacen mucha falta.
 *
 *   yarn test:e2e:tools
 *   PW_FINGERPRINT=antes.json yarn test:e2e:tools --grep huella
 */
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ON_DEMAND,
  // Capturar páginas completas y recorrer una docena de rutas no entra en 30 s.
  timeout: 180_000,
});
