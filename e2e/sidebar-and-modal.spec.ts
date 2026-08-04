import { expect, test } from '@playwright/test';

/**
 * Dos defectos de la misma familia: algo que se pinta donde no debe.
 *
 * 1. La X de la barra lateral pertenece al modo CAJÓN (bajo 820 px). Su regla
 *    `display: none` empataba en especificidad con `.icon-button` y perdía por
 *    ir antes, así que el botón salía en escritorio; pulsarlo ponía el estado en
 *    «cerrado» y no ocurría nada, porque la regla que desplaza la barra vive en
 *    el media query. Un botón que no hace nada es peor que no tener botón.
 *
 * 2. Los diálogos usan `position: fixed`, que se posiciona respecto al viewport
 *    SALVO que un ancestro tenga `transform`. `.route-view` anima su entrada con
 *    `animation-fill-mode: both`, que deja fijado el estado final —incluido un
 *    transform identidad, invisible— para siempre. Medido: el fondo del modal
 *    empezaba en `top: -399` y medía 2021 px, así que la tarjeta se centraba
 *    respecto al documento y aparecía abajo y cortada.
 */
const SESSION = {
  accessToken: 'e2e-token',
  tokenType: 'Bearer' as const,
  expiresIn: '3600',
  user: {
    id: '1',
    tenantId: '1',
    email: 'qa@atlas.local',
    fullName: 'QA Atlas',
    name: 'QA Atlas',
    userCode: null,
    status: 'ACTIVE',
    department: null,
    jobTitle: null,
    mustChangePassword: false,
    mfaEnabled: false,
    roles: ['RISK_ANALYST', 'PLATFORM_ADMIN'],
    legacyRoles: [],
    permissions: [],
  },
};

const ROWS = Array.from({ length: 25 }, (_, index) => ({
  id: String(index + 1),
  code: `MOTIVO_DE_PRUEBA_${index}`,
  category: 'AFFORDABILITY',
  severity: 'HIGH',
  publicMessage: 'La cuota estimada excede tu capacidad de pago actual.',
  internalMessage: 'affordability_ratio excede el umbral de politica.',
}));

async function mockPortal(page: import('@playwright/test').Page) {
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: SESSION });
    return route.fulfill({
      json: { items: ROWS, page: 1, pageSize: 25, total: 96, totalPages: 4, hasNextPage: true },
    });
  });
}

test('en escritorio no se pinta una X que no cierra nada', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPortal(page);
  await page.goto('/reason-codes', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.sidebar-close')).toBeHidden();
});

test('en el cajón sí aparece, porque ahí sí cierra', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 700, height: 900 });
  await mockPortal(page);
  await page.goto('/reason-codes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const shown = await page.evaluate(() => {
    const button = document.querySelector('.sidebar-close');
    return button ? getComputedStyle(button).display !== 'none' : false;
  });
  expect(shown).toBe(true);
});

test('el diálogo de exportar se centra en la pantalla, no en el documento', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPortal(page);
  await page.goto('/reason-codes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page
    .getByRole('button', { name: /Exportar/i })
    .first()
    .click();

  const box = page.locator('.modal-dialog');
  await expect(box).toBeVisible({ timeout: 15_000 });

  const geometry = await box.evaluate((card) => {
    const backdrop = document.querySelector('.dialog-backdrop') as HTMLElement;
    const b = backdrop.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return {
      fondoCubreLaPantalla: Math.abs(b.top) < 2 && Math.abs(b.height - window.innerHeight) < 2,
      tarjetaDentro: c.top >= 0 && c.bottom <= window.innerHeight + 1,
    };
  });

  expect(geometry).toEqual({ fondoCubreLaPantalla: true, tarjetaDentro: true });
});
