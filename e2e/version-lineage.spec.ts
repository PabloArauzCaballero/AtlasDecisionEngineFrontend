import { expect, test } from '@playwright/test';
import { MOCK_SESSION } from './support/backend-mock';
import { denseBackend } from './support/dense-backend';

/**
 * El historial de versiones de un artefacto, leído como un repositorio.
 *
 * El motor no tiene ramas con nombre: cada versión guarda `sourceVersionId` —de
 * cuál se clonó— y nada más (`decision_artifact_version`, columna
 * `source_version_id`, nula en la primera). Clonar una versión que NO es la
 * última es lo que abre una línea paralela, y eso es lo único que aquí puede
 * llamarse rama. Esta prueba fija esa lectura con un linaje que se bifurca.
 *
 * Se monta el sobre exacto de `GET /v1/artifacts/:artifactId` (los BigInt viajan
 * como texto: `main.ts` del motor le pone `toJSON` a `BigInt`), porque el motor
 * simulado normal devuelve listados vacíos y un artefacto sin versiones sólo
 * enseña el estado vacío.
 */
function version(id: string, n: number, source: string | null, summary: string, status: string) {
  return {
    id,
    artifactId: '900',
    versionNumber: n,
    status,
    sourceVersionId: source,
    semanticVersion: `${n}.0.0`,
    changeSummary: summary,
    authoringNotes: null,
    canonicalChecksum: `sha256:${id}aa11bb22cc33dd44ee55ff66`,
    lockVersion: 1,
    createdBy: n % 2 ? 'ana.rivera' : 'luis.paz',
    createdAt: `2026-0${n}-1${n}T10:00:00Z`,
    compiledArtifacts: [],
    deployments: [],
  };
}

const ARTIFACT = {
  id: '900',
  artifactCode: 'EXTRACTO_CAPACIDAD_PAGO',
  name: 'Capacidad de pago verificada por extracto bancario',
  description: 'Decide si el ingreso declarado se sostiene con el extracto bancario.',
  artifactType: 'CREDIT_POLICY',
  ownerTeam: 'RISK_DECISIONING',
  riskDomain: 'CREDIT',
  isActive: true,
  createdAt: '2026-01-10T10:00:00Z',
  // El motor las devuelve de la más nueva a la más vieja (`versionNumber desc`).
  // v4 y v5 salen las dos de v3: ahí está la bifurcación.
  versions: [
    version('5', 5, '3', 'Rama paralela: umbral conservador para pruebas', 'DRAFT'),
    version('4', 4, '3', 'Sube el umbral de ingreso al 35 %', 'IN_REVIEW'),
    version('3', 3, '2', 'Añade validación de antigüedad de cuenta', 'APPROVED'),
    version('2', 2, '1', 'Corrige el redondeo del promedio mensual', 'COMPILED'),
    version('1', 1, null, 'Initial draft', 'RETIRED'),
  ],
};

test('el detalle del artefacto cuenta su historia como un repositorio', async ({ page }) => {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('unread-count')) return route.fulfill({ json: { unread: 0 } });
    if (/\/v1\/artifacts\/900(\?|$)/.test(url)) return route.fulfill({ json: ARTIFACT });
    return route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });
  await page.setViewportSize({ width: 1512, height: 1000 });
  await page.goto('/artifacts/900?tab=versions', { waitUntil: 'domcontentloaded' });

  // Título y descripción del artefacto, que es lo que identifica el historial.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Capacidad de pago');
  await expect(page.getByText(ARTIFACT.description)).toBeVisible();

  const filas = page.locator('.version-graph-row');
  await expect(filas).toHaveCount(5);

  /*
   * El mensaje de cada versión, VISIBLE.
   *
   * Es la comprobación que faltaba: la fila tiene alto fijo —el riel de commits
   * se dibuja con ese número— y el resumen lleva `overflow:hidden` para los
   * puntos suspensivos, lo cual apaga su tamaño mínimo automático. Cuando el
   * alto de la fila se quedó corto, este párrafo fue el único que pudo encogerse
   * y se quedó en altura CERO: el grafo seguía dibujándose, con todos sus
   * commits mudos. `toBeVisible` no lo habría visto —un elemento de altura 0 con
   * texto sigue contando como visible para Playwright—, así que se mide.
   */
  const resumenes = await filas.locator('.version-graph-summary').evaluateAll((nodes) =>
    nodes.map((node) => ({
      alto: Math.round(node.getBoundingClientRect().height),
      texto: (node.textContent || '').trim(),
    })),
  );
  expect(resumenes.map((resumen) => resumen.texto)).toEqual(
    ARTIFACT.versions.map((v) => v.changeSummary),
  );
  for (const resumen of resumenes) expect(resumen.alto).toBeGreaterThan(8);

  /*
   * La bifurcación abre un segundo carril: dos versiones cuelgan de la misma.
   *
   * Se cuentan las POSICIONES horizontales que ocupan los puntos, no el ancho
   * del SVG. El ancho sale de `PAD_X * 2 + (carriles - 1) * LANE_W`, así que
   * afirmarlo en píxeles ata la prueba a dos constantes de dibujo: esta misma
   * comprobación ya se rompió dos veces —primero pidiendo un tercer carril que
   * el lineaje no tiene, después clavando 54 cuando el margen pasó de 16 a 18—
   * sin que el lineaje hubiera cambiado en nada. Cuántos carriles hay es lo que
   * la prueba quiere demostrar; cuánto miden es decisión del diseño.
   */
  const carriles = await page
    .locator('.version-graph-rails circle')
    .evaluateAll((puntos) => new Set(puntos.map((punto) => punto.getAttribute('cx'))).size);
  expect(carriles, 'la bifurcación abre un segundo carril').toBe(2);

  /*
   * Y el riel apunta a la fila que dice apuntar. El SVG es un hermano de la
   * lista dibujado con geometría absoluta, así que un cambio de alto en la fila
   * lo descuadra en silencio: cada punto tiene que caer a la altura del número
   * de versión de SU fila.
   */
  const desvios = await page.evaluate(() => {
    const puntos = [...document.querySelectorAll('.version-graph-rails circle')];
    const titulos = [...document.querySelectorAll('.version-graph-heading')];
    const centro = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    return titulos.map((titulo, index) =>
      puntos[index] ? Math.abs(centro(puntos[index]) - centro(titulo)) : 999,
    );
  });
  for (const desvio of desvios) expect(desvio).toBeLessThanOrEqual(3);
});

/**
 * Y la puerta de entrada: el listado tiene que ofrecer esa vista.
 *
 * El icono de la última columna era la única forma de abrir un registro, y en
 * una tabla más ancha que su marco vive fuera de lo que se ve —medido a 1512 px:
 * 1436 px de tabla en 1166 px de marco—. Se comprueban las dos puertas: la
 * columna anclada a la derecha y el enlace con su nombre escrito en la fila
 * desplegada.
 */
test('el listado ofrece la vista de detalle sin desplazar la tabla', async ({ page }) => {
  await denseBackend(page);
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.goto('/artifacts', { waitUntil: 'domcontentloaded' });

  const acciones = page.locator('.data-table tbody td.table-actions').first();
  await expect(acciones).toBeVisible();
  const dentro = await page.evaluate(() => {
    const marco = document.querySelector('.table-wrap')!.getBoundingClientRect();
    const celda = document.querySelector('.data-table tbody td.table-actions')!;
    const caja = celda.getBoundingClientRect();
    return caja.right <= marco.right + 1 && caja.left >= marco.left - 1;
  });
  expect(dentro, 'la columna de acciones queda dentro del marco visible').toBe(true);

  await page.getByRole('button', { name: 'Ver el detalle completo' }).first().click();
  const abrir = page.locator('.table-detail').getByRole('link', { name: 'Ver detalle' });
  await expect(abrir).toBeVisible();
  await expect(abrir).toHaveAttribute('href', /^\/artifacts\//);
});
