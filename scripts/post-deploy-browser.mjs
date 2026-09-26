#!/usr/bin/env node
import { chromium } from '@playwright/test';

const base = process.env.SMOKE_BASE_URL;
if (!base || !/^https?:\/\//.test(base)) throw new Error('SMOKE_BASE_URL debe ser HTTP(S).');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('/login', base).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Iniciar sesión' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(750);
  if (errors.length) throw new Error(`Login lanzó errores JS: ${errors.join('; ')}`);
  console.log('Smoke de navegador OK: login renderiza sin errores JS.');
} finally {
  await browser.close();
}
