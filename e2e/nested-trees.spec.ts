import { expect, test, type Page } from '@playwright/test';
import { ARTIFACT_IDS, nestedTreesBackend } from './support/nested-trees-backend';

/**
 * Los dos paneles del grafo de dependencias, con árboles anidados de verdad.
 *
 * La vista saca AMBOS paneles de una sola respuesta —`/dependency-graph`— y los
 * separa filtrando las aristas por el artefacto abierto. Eso significa que un
 * error de filtro no se nota: los dos paneles seguirían pintando algo. Aquí se
 * comprueba cuál es cada uno, artefacto por artefacto, en las tres posiciones
 * que existen en la familia: hoja, intermedio y raíz.
 *
 * La familia y su sentido de negocio están en `docs/arboles-anidados.md`.
 */

const DEPENDE_DE = 'Depende de (referencias salientes)';
const REFERENCIADO_POR = 'Referenciado por (dependientes)';

function panel(page: Page, titulo: string) {
  return page.locator('.panel').filter({ has: page.getByText(titulo, { exact: true }) });
}

async function abrir(page: Page, artifactId: string) {
  await nestedTreesBackend(page);
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.goto(`/artifacts/${artifactId}/dependency-graph`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dependency graph');
}

test('el árbol intermedio llena los dos paneles a la vez', async ({ page }) => {
  await abrir(page, ARTIFACT_IDS.riesgo);

  // Consulta a dos hijos distintos, uno por rama de exposición.
  const salientes = panel(page, DEPENDE_DE).locator('.dependency-list li');
  await expect(salientes).toHaveCount(2);
  await expect(salientes.locator('.dependency-node-key')).toHaveText([
    'RIESGO_POR_CAPACIDAD',
    'RIESGO_POR_SOLVENCIA',
  ]);
  await expect(salientes.nth(0).getByRole('link')).toHaveAttribute(
    'href',
    `/artifacts/${ARTIFACT_IDS.capacidad}`,
  );
  await expect(salientes.nth(1).getByRole('link')).toHaveText(/SOLVENCIA_BURO/);

  // Y lo consumen dos productos distintos: esa es la reutilización que hace que
  // partir el árbol valga la pena, y sin ella el panel derecho estaría vacío.
  const entrantes = panel(page, REFERENCIADO_POR).locator('.dependency-list li');
  await expect(entrantes).toHaveCount(2);
  await expect(entrantes.locator('.dependency-node-key')).toHaveText([
    'EVALUA_RIESGO',
    'TC_EVALUA_RIESGO',
  ]);
  await expect(entrantes.nth(1).getByRole('link')).toHaveAttribute(
    'href',
    `/artifacts/${ARTIFACT_IDS.tarjeta}`,
  );

  // El panel del centro identifica al artefacto abierto, no al primero del lote.
  const centro = panel(page, 'Este artefacto');
  await expect(centro).toContainText('Riesgo crediticio del solicitante');
  await expect(centro).toContainText('RIESGO_CREDITICIO');

  /*
   * Ningún enlace apunta al artefacto que ya se está viendo: un lazo a sí mismo
   * en esta vista sería un ciclo, que es justo lo que el motor prohíbe
   * (`CIRCULAR_ARTIFACT_REFERENCE`). Si el filtro de aristas se rompiera y
   * dejara pasar las cuatro a los dos lados, los conteos de arriba podrían
   * seguir cuadrando; esto no.
   */
  const destinos = await page
    .locator('.dependency-list a')
    .evaluateAll((enlaces) => enlaces.map((enlace) => enlace.getAttribute('href')));
  expect(destinos).not.toContain(`/artifacts/${ARTIFACT_IDS.riesgo}`);
  expect(destinos).toHaveLength(4);
});

test('una hoja no depende de nadie y una raíz no es referenciada por nadie', async ({ page }) => {
  await abrir(page, ARTIFACT_IDS.solvencia);

  await expect(panel(page, DEPENDE_DE)).toContainText(
    'Este artefacto no referencia ningún otro árbol de decisión.',
  );
  const consumidores = panel(page, REFERENCIADO_POR).locator('.dependency-list li');
  await expect(consumidores).toHaveCount(1);
  await expect(consumidores.getByRole('link')).toHaveAttribute(
    'href',
    `/artifacts/${ARTIFACT_IDS.riesgo}`,
  );

  await abrir(page, ARTIFACT_IDS.originacion);

  await expect(panel(page, DEPENDE_DE).locator('.dependency-list li')).toHaveCount(1);
  await expect(panel(page, REFERENCIADO_POR)).toContainText(
    'Ningún otro artefacto referencia a este árbol de decisión.',
  );
});

/**
 * Y desde la raíz se puede bajar hasta la hoja navegando, que es para lo que
 * sirve la vista: dos saltos, tres niveles, sin escribir una URL a mano.
 */
test('la cadena completa se recorre saltando de panel en panel', async ({ page }) => {
  await abrir(page, ARTIFACT_IDS.tarjeta);

  await panel(page, DEPENDE_DE).getByRole('link').first().click();
  await expect(page).toHaveURL(new RegExp(`/artifacts/${ARTIFACT_IDS.riesgo}$`));

  await page.goto(`/artifacts/${ARTIFACT_IDS.riesgo}/dependency-graph`, {
    waitUntil: 'domcontentloaded',
  });
  await panel(page, DEPENDE_DE).getByRole('link').first().click();
  await expect(page).toHaveURL(new RegExp(`/artifacts/${ARTIFACT_IDS.capacidad}$`));
});
