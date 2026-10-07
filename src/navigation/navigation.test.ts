import { describe, expect, it } from 'vitest';
import { assistScreenFor } from '../features/assist/assist-screen';
import { navigation } from './navigation';

/**
 * El menú se recortó el 2026-10-07: las pantallas hermanas comparten una línea que se despliega.
 * Agrupar no puede perder una pantalla ni dársela a quien no la veía.
 */
const lines = navigation.flatMap((section) => section.items);
const groups = lines.filter((item) => item.children && item.path !== '/workers');
const routes = lines.flatMap((item) =>
  item.children ? item.children.map((child) => child.path) : [item.path],
);

describe('menú del Motor tras el recorte', () => {
  it('siete secciones y veintiuna líneas', () => {
    expect(navigation.map((section) => section.label)).toEqual([
      'Plataforma',
      'Diseño',
      'Calidad',
      'Gobierno',
      'Operación',
      'Auditoría',
      'Procesamiento',
    ]);
    expect(lines).toHaveLength(21);
  });

  it('cada grupo dice qué pantallas junta', () => {
    expect(
      Object.fromEntries(
        groups.map((group) => [group.label, group.children?.map((child) => child.label)]),
      ),
    ).toEqual({
      Catálogos: ['Variables', 'Campos calculados', 'Motivos'],
      Diagrama: ['Editor del diagrama', 'Acciones'],
      Código: ['Importar código', 'Librerías autorizadas'],
      Pruebas: ['Suites de prueba', 'Casos de prueba'],
      Cobertura: ['Cobertura del diagrama', 'Objetivos', 'Cobertura de objetivos'],
      'Ambientes y despliegues': ['Ambientes', 'Despliegues'],
    });
  });

  it('ninguna pantalla del menú anterior se quedó sin camino, ni aparece dos veces', () => {
    for (const path of PREVIOUS_ROUTES) expect(routes, path).toContain(path);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('un grupo sale a quien puede abrir alguna de sus pantallas, y sólo a esos', () => {
    for (const group of groups) {
      const union = new Set(group.children?.flatMap((child) => child.roles));
      expect(new Set(group.roles), group.label).toEqual(union);
    }
  });

  it('el asistente sigue nombrando la pantalla, no el estante que la agrupa', () => {
    expect(assistScreenFor('/variables')).toBe('Diseño › Variables');
    expect(assistScreenFor('/coverage-matrix')).toBe('Calidad › Cobertura de objetivos');
  });
});

/** Las rutas que el menú listaba antes del recorte (origin/dev, 61c5751), sin los procesadores. */
const PREVIOUS_ROUTES = [
  '/platform-health',
  '/search',
  '/tutorials',
  '/variables',
  '/calculated-fields',
  '/libraries',
  '/reason-codes',
  '/algorithms',
  '/graph-editor',
  '/actions',
  '/code-import',
  '/test-suites',
  '/test-cases',
  '/qa-lab',
  '/graph-coverage',
  '/reviews',
  '/environments',
  '/deployments',
  '/risk-governance',
  '/simulator',
  '/manual-reviews',
  '/executions',
  '/audit-events',
  '/model-monitoring',
  '/sql-console',
  '/data-notebook',
  '/objectives',
  '/coverage-matrix',
];
