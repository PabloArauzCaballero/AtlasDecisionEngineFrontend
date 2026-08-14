import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './support/backend-mock';
import { ALL_ROUTES, SWEEP_TIMEOUT_MS } from './support/contrast-probe';

/**
 * Accesibilidad automática sobre el DOM pintado, en las dos temáticas.
 *
 * No existía. El repositorio medía el CONTRASTE con mucho detalle —tokens,
 * DOM real, dos temas, estados abiertos— y de ahí se seguía leyendo que el
 * portal era accesible, cuando el contraste es un criterio de unos cincuenta.
 * Lo que se escapaba por ese hueco no era sutil: el `<main>` del armazón
 * envolvía otro `<main>` en cinco vistas, los 85 paneles titulaban con un
 * `<span>` en negrita en vez de un encabezado, y el menú de tutoriales vivía
 * dentro del `<h1>` de todas las páginas.
 *
 * Con `axe` no se puede firmar una declaración de conformidad —ninguna
 * herramienta automática cubre más o menos de un tercio de WCAG—, pero sí
 * impide que vuelvan las familias de fallo que sí detecta.
 */

/**
 * Etiquetas de regla. `wcag21aa` incluye `wcag2a` y `wcag2aa`, que es
 * exactamente el nivel que exigen Section 508 en Estados Unidos y el eMAG junto
 * con la Lei Brasileira de Inclusão.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Reglas suspendidas, con motivo y fecha. Vacío a propósito: una lista de
 * excepciones sin dueño se convierte en el sitio donde van a morir los fallos
 * nuevos. Si hay que añadir una, que sea con el porqué y con qué la retira.
 */
const SUSPENDED: string[] = [];

async function analyse(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  /*
   * Señal POSITIVA de que la vista está montada, no una espera a plazo fijo. Es
   * la misma cautela que el resto del barrido: en desarrollo la primera visita
   * compila al vuelo, y analizar una pantalla vacía devuelve cero fallos —que se
   * lee igual que «no hay fallos»—.
   */
  await expect(page.locator('#main-content')).toContainText(/\S/, { timeout: 60_000 });
  await page.waitForTimeout(300);

  const results = await new AxeBuilder({ page }).withTags(TAGS).disableRules(SUSPENDED).analyze();
  return results.violations;
}

function describe(
  violations: {
    id: string;
    impact?: string | null;
    help: string;
    nodes: { target: unknown[] }[];
  }[],
  route: string,
): string {
  return violations
    .map(
      (violation) =>
        `  ${route} · [${violation.impact ?? 'n/d'}] ${violation.id}: ${violation.help}\n` +
        violation.nodes
          .slice(0, 4)
          .map((node) => `      ${String(node.target)}`)
          .join('\n'),
    )
    .join('\n');
}

for (const theme of ['light', 'dark'] as const) {
  const label = theme === 'dark' ? 'oscuro' : 'claro';

  test(`ninguna ruta incumple WCAG 2.1 AA detectable en tema ${label}`, async ({ page }) => {
    test.setTimeout(SWEEP_TIMEOUT_MS);
    await mockBackend(page);
    await page.addInitScript((value) => window.localStorage.setItem('atlas.theme', value), theme);

    const report: string[] = [];
    for (const route of ALL_ROUTES) {
      const violations = await analyse(page, route);
      if (violations.length) report.push(describe(violations, route));
    }

    expect(report, `Incumplimientos en tema ${label}:\n${report.join('\n')}`).toEqual([]);
  });
}

/**
 * Los dos defectos estructurales que el barrido anterior destapó, fijados
 * aparte: son de los que vuelven en cuanto alguien copia una vista existente
 * para hacer una nueva, y en un informe de 25 rutas un fallo así se lee como
 * ruido en vez de como el defecto sistemático que es.
 */
test('el documento tiene un solo landmark principal y encabezados reales', async ({ page }) => {
  test.setTimeout(SWEEP_TIMEOUT_MS);
  await mockBackend(page);

  for (const route of ['/executions', '/manual-reviews', '/test-cases', '/artifacts']) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('#main-content')).toContainText(/\S/, { timeout: 60_000 });

    // Un `<main>` dentro de otro es HTML inválido y deja dos landmarks con el
    // mismo papel: la navegación por regiones deja de llevar a ningún sitio.
    await expect(page.locator('main'), `${route} debe tener un único <main>`).toHaveCount(1);

    /*
     * Toda `<section>` tiene nombre accesible.
     *
     * La regla se expresa así y no como «todo `.panel` lleva un encabezado»
     * porque no todos son secciones: unos cuantos `panel` sólo envuelven un
     * estado vacío o una tabla, sin título ninguno. Una `<section>` sin nombre
     * no se expone como región, así que declararla no aporta nada y ensucia la
     * navegación por landmarks; ésas ahora son `<div>`. Lo que no puede pasar es
     * lo que pasaba: una sección con título VISIBLE —un `<span>` en negrita— que
     * no es ni encabezado ni nombre.
     */
    const anonymous = page.locator(
      'section.panel:not([aria-label]):not([aria-labelledby]):not([aria-label=""])',
    );
    await expect(
      anonymous,
      `${route}: hay <section class="panel"> sin nombre accesible; si no titula nada, debe ser un <div>`,
    ).toHaveCount(0);

    // El título de la página no arrastra el texto de los controles que lleva al
    // lado (la ayuda y el menú de tutoriales).
    await expect(page.locator('h1 button')).toHaveCount(0);
  }
});
