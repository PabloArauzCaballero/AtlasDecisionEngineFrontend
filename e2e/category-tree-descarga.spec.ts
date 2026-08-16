import { expect, test, type Download, type Page } from '@playwright/test';
import { mockWorkersBackend } from './support/workers-backend';

/**
 * La descarga del árbol de categorías.
 *
 * Lo que se comprueba aquí no es que el navegador guarde un archivo: es que ese
 * archivo AFIRME la verdad. Una exportación que se limitara a lo que hay pintado
 * en pantalla produciría un archivo distinto según cómo estuviera el plegado, y
 * el que le faltaran ramas no lo diría en ninguna parte — se abre, tiene buena
 * pinta, y alguien lo archiva como si fuera el catálogo.
 *
 * Por eso las dos pruebas COLAPSAN el árbol antes de descargar. Es el estado en
 * el que la exportación equivocada y la correcta se distinguen; con todo
 * expandido las dos darían el mismo archivo y pasarían igual estando rota.
 *
 * Contra el motor simulado, no el real: aquí no se mide qué guarda el motor,
 * sino qué escribe el navegador con un catálogo dado. El CRUD contra la base
 * real lo cubre `portal-real-categorias.spec.ts`.
 */

const RUTA = '/workers/semantic-analysis?vista=categorias';

/** Todas las categorías del simulado, incluidas las que arrancan plegadas. */
const TODAS = [
  'GASTOS',
  'GASTOS.VIVIENDA',
  'GASTOS.VIVIENDA.LUZ',
  'GASTOS.VIVIENDA.AGUA',
  'INGRESOS',
  'INGRESOS.SALARIO',
];

async function abrirCategorias(page: Page): Promise<void> {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.categoria-arbol')).toBeVisible({ timeout: 60_000 });
}

/**
 * Colapsa el árbol y descarga, devolviendo el texto del archivo.
 *
 * El colapso es la parte que da valor a la prueba: deja fuera de la pantalla
 * cuatro de las seis categorías, así que un archivo con seis sólo puede venir
 * del catálogo y no de lo que se estaba viendo.
 */
async function descargarColapsado(page: Page, boton: RegExp): Promise<string> {
  await page.getByRole('button', { name: /Colapsar todo/ }).click();
  await expect(page.getByText('GASTOS.VIVIENDA', { exact: true })).toHaveCount(0);

  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: boton }).click(),
  ]);
  return leer(descarga);
}

async function leer(descarga: Download): Promise<string> {
  const ruta = await descarga.path();
  expect(ruta, 'la descarga no llegó a disco').not.toBeNull();
  const { readFile } = await import('node:fs/promises');
  return readFile(ruta, 'utf8');
}

test.describe('descarga del árbol de categorías', () => {
  test.setTimeout(120_000);

  test('el JSON lleva el catálogo completo y con la jerarquía dentro', async ({ page }) => {
    await mockWorkersBackend(page);
    await abrirCategorias(page);
    const texto = await descargarColapsado(page, /Descargar JSON/);
    const documento = JSON.parse(texto) as {
      total: number;
      exportedAt: string;
      categories: { code: string; children: { code: string; children: unknown[] }[] }[];
    };

    // Completo: las cuatro categorías que el colapso escondió siguen dentro.
    expect(documento.total).toBe(TODAS.length);
    expect(texto).toContain('GASTOS.VIVIENDA.LUZ');
    expect(texto).toContain('GASTOS.VIVIENDA.AGUA');

    // Jerárquico: las hijas están DENTRO de su rama, no en una lista plana.
    expect(documento.categories.map((raiz) => raiz.code)).toEqual(['GASTOS', 'INGRESOS']);
    const vivienda = documento.categories[0].children[0];
    expect(vivienda.code).toBe('GASTOS.VIVIENDA');
    expect(vivienda.children).toHaveLength(2);

    // Y lleva sello: un archivo de catálogo sin fecha no se puede comparar con otro.
    expect(Date.parse(documento.exportedAt)).not.toBeNaN();
  });

  test('el CSV lleva las mismas filas, en su cabecera de contrato', async ({ page }) => {
    await mockWorkersBackend(page);
    await abrirCategorias(page);
    const texto = await descargarColapsado(page, /Descargar CSV/);
    const lineas = texto.trim().split(/\r?\n/);

    // La marca de orden de bytes va delante: sin ella Excel en Windows lee el
    // archivo como ANSI y toda descripción con tilde sale rota.
    expect(texto.startsWith('﻿')).toBe(true);
    expect(lineas[0]).toContain('code,name,description,parentCode');
    // Cabecera + una fila por categoría, incluidas las que estaban plegadas.
    expect(lineas).toHaveLength(TODAS.length + 1);
    for (const code of TODAS) expect(texto).toContain(`"${code}"`);
  });

  test('sin catálogo no se ofrece una descarga vacía', async ({ page }) => {
    await mockWorkersBackend(page);
    // Se registra DESPUÉS del simulado: Playwright resuelve la ruta más
    // reciente primero, así que puesta antes no llegaría a aplicarse nunca.
    await page.route('**/v1/workers/semantic-analysis/categories*', (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Sin categorías no hay árbol que esperar: la vista pinta su estado vacío.
    await expect(page.locator('.categoria-vacio')).toBeVisible({ timeout: 60_000 });

    // Un botón que produce un archivo con cero filas se lee como «no hay nada
    // que exportar» sólo DESPUÉS de abrirlo. Apagado lo dice antes.
    await expect(page.getByRole('button', { name: /Descargar JSON/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Descargar CSV/ })).toBeDisabled();
  });
});
