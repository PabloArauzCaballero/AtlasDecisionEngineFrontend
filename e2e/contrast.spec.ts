import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './support/backend-mock';
import {
  AA_FLOOR,
  ALL_ROUTES,
  SWEEP_TIMEOUT_MS,
  describeOffenders,
  lowContrastNodes,
  type Offender,
} from './support/contrast-probe';

/**
 * Contraste real de los dos temas, medido en el navegador.
 *
 * `theme-contrast.test.ts` verifica los tokens; ésta verifica lo que de verdad
 * ve el usuario, que es otra cosa: basta que una hoja escriba un color literal
 * para que la letra deje de seguir al tema mientras su fondo sí lo hace.
 * Recorre el DOM pintado, calcula el contraste efectivo de cada texto contra el
 * primer fondo opaco que tiene detrás y falla si alguno baja del mínimo.
 *
 * Se mide en los dos temas a propósito. Al migrar colores literales a token
 * aparecieron desajustes en las dos direcciones —letra clara sobre panel claro
 * y letra oscura sobre panel oscuro—, y comprobar sólo uno los habría dejado
 * pasar. En claro destapó además un fallo que ya estaba: los rótulos de sección
 * de la barra lateral llevaban años en 2,81:1.
 */

/**
 * Suelo de nodos inspeccionados por ruta.
 *
 * Sin esto la prueba pasaría igual de bien si la página no cargara: cero textos
 * examinados son cero incumplimientos. Exigir un mínimo convierte "no encontré
 * nada malo" en "miré de verdad y no encontré nada malo".
 */
const MIN_INSPECTED = 15;

/**
 * Estados que sólo existen tras interactuar.
 *
 * La carga inicial de una ruta no enseña ni un diálogo, ni una fila desplegada,
 * ni un formulario en error — y ahí es donde vive buena parte del color que
 * nadie ha medido nunca. Cada entrada abre su estado y devuelve si lo consiguió;
 * un estado que no se pueda abrir se denuncia en vez de darse por comprobado.
 */
const STATES: {
  name: string;
  route: string;
  /** Opciones extra del motor simulado, cuando el estado las necesita. */
  mock?: Parameters<typeof mockBackend>[1];
  open: (page: Page) => Promise<unknown>;
}[] = [
  {
    name: 'diálogo de nuevo objetivo',
    route: '/objectives',
    open: async (page) => {
      await page
        .getByRole('button', { name: /Crear objetivo|Nuevo objetivo/i })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    name: 'diálogo de nuevo despliegue',
    route: '/deployments',
    open: async (page) => {
      await page
        .getByRole('button', { name: /Nuevo despliegue|Desplegar/i })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    name: 'centro de notificaciones',
    route: '/platform-health',
    open: async (page) => {
      await page
        .getByRole('button', { name: /Notificaciones/i })
        .first()
        .click();
      await expect(page.getByRole('dialog', { name: /Notificaciones/i })).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  {
    name: 'guía de lectura del tutorial',
    route: '/artifacts',
    open: async (page) => {
      // El botón abre primero un menú (recorrido guiado / leer); aquí interesa
      // el cajón de lectura, que es el que trae texto largo.
      await page.getByRole('button', { name: 'Tutorial', exact: true }).first().click();
      await page.getByRole('menuitem', { name: /Leer la guía/ }).click();
      await expect(page.locator('.tutorial-overlay, .tutorial-drawer').first()).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  {
    name: 'recorrido guiado del tutorial',
    route: '/variables',
    open: async (page) => {
      await page.getByRole('button', { name: 'Tutorial', exact: true }).first().click();
      await page.getByRole('menuitem', { name: /Recorrido guiado/ }).click();
      await expect(page.locator('.tutorial-overlay')).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    name: 'acceso con credenciales rechazadas',
    route: '/login',
    // El motor simulado devuelve 401 en `/v1/session/**` para que el formulario
    // pinte de verdad su estado de error en vez de entrar.
    mock: { loginStatus: 401 },
    open: async (page) => {
      // Los tres campos son obligatorios: sin el tenant el formulario ni llega a
      // enviarse y la prueba mediría la pantalla en reposo.
      // Se localizan por tipo de campo: los rótulos casan de más —«Correo»
      // también con la casilla de recordar, «Contraseña» con el botón de
      // mostrarla— y el modo estricto de Playwright lo rechaza con razón.
      await page.getByLabel(/Tenant/i).fill('1');
      await page.locator('input[type="email"]').fill('quien@atlas.bo');
      await page.locator('input[type="password"]').fill('no-es-la-buena');
      await page
        .getByRole('button', { name: /Iniciar sesión/i })
        .first()
        .click();
      // `.first()`: el fallo se anuncia por dos vías (el aviso del formulario y
      // el toast global), y sin acotar, el modo estricto lo toma por ambigüedad.
      await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 15_000 });
    },
  },
];

for (const theme of ['dark', 'light'] as const) {
  const label = theme === 'dark' ? 'oscuro' : 'claro';

  test(`ningún texto queda ilegible en tema ${label}`, async ({ page }) => {
    await measureTheme(page, theme);
  });

  test(`ningún texto queda ilegible en tema ${label} con la interfaz abierta`, async ({ page }) => {
    await measureStates(page, theme);
  });
}

async function measureStates(page: Page, theme: 'dark' | 'light') {
  test.setTimeout(SWEEP_TIMEOUT_MS);
  await page.addInitScript((value) => window.localStorage.setItem('atlas.theme', value), theme);

  const offenders: (Offender & { route: string })[] = [];
  const unopened: string[] = [];
  for (const state of STATES) {
    // Se vuelve a registrar por estado: algunos necesitan que el motor simulado
    // responda distinto (un acceso rechazado, por ejemplo).
    await mockBackend(page, state.mock);
    await page.goto(state.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.waitForTimeout(600);
    try {
      await state.open(page);
    } catch {
      // No se da por bueno en silencio: si el estado dejó de poder abrirse, esta
      // prueba estaría midiendo la página de fondo y creyendo que lo cubrió.
      unopened.push(state.name);
      continue;
    }
    await page.waitForTimeout(400);
    const { offenders: found } = await lowContrastNodes(page, AA_FLOOR);
    for (const offender of found) offenders.push({ ...offender, route: state.name });
  }

  expect(unopened, `Estados que no se pudieron abrir: ${unopened.join(', ')}`).toEqual([]);

  const report = describeOffenders(offenders);
  expect(offenders, `Texto por debajo de ${AA_FLOOR}:1 en tema ${theme}:\n${report}`).toEqual([]);
}

async function measureTheme(page: Page, theme: 'dark' | 'light') {
  test.setTimeout(SWEEP_TIMEOUT_MS);
  await mockBackend(page);
  // El tema se resuelve antes del primer pintado leyendo esta preferencia.
  await page.addInitScript((value) => window.localStorage.setItem('atlas.theme', value), theme);

  const offenders: (Offender & { route: string })[] = [];
  const thin: string[] = [];
  for (const route of ALL_ROUTES) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    // Se espera a que la vista tenga contenido en lugar de a un plazo fijo: en
    // desarrollo la primera visita a una ruta la compila al vuelo y cualquier
    // número redondo se queda corto justo en las rutas más pesadas.
    await expect(page.locator('#main-content')).toContainText(/\S/, { timeout: 60_000 });
    await page.waitForTimeout(400);
    const { offenders: found, inspected } = await lowContrastNodes(page, AA_FLOOR);
    if (inspected < MIN_INSPECTED) thin.push(`${route} (${inspected})`);
    for (const offender of found) offenders.push({ ...offender, route });
  }

  // Se comprueba ANTES que el contraste: una ruta que no pintó nada no puede
  // pasar por "ruta sin problemas".
  expect(thin, `Rutas con demasiado poco texto inspeccionado: ${thin.join(', ')}`).toEqual([]);

  const report = describeOffenders(offenders);
  expect(offenders, `Texto por debajo de ${AA_FLOOR}:1 en tema ${theme}:\n${report}`).toEqual([]);
}
