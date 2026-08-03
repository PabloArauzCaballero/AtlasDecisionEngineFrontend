import { describe, expect, it } from 'vitest';
import { enumeratePaths } from './flow-paths';

/**
 * Enumerar los recorridos es lo que hace visible el conjunto COMPLETO de
 * posibilidades de un árbol. Sin esto hay que seguir las flechas a ojo, que es
 * exactamente donde se cuela la rama olvidada.
 */
const node = (key: string, type = 'CONDITION', extra = {}) => ({
  key,
  type,
  terminal: type === 'RESULT' || type === 'END',
  ...extra,
});
const edge = (from: string, to: string, extra = {}) => ({
  key: `${from}__${to}`,
  from,
  to,
  ...extra,
});

describe('recorridos posibles del árbol', () => {
  it('enumera una rama por cada salida de la bifurcación', () => {
    const nodes = [
      node('START', 'START'),
      node('EDAD'),
      node('APROBAR', 'RESULT'),
      node('RECHAZAR', 'RESULT'),
    ];
    const edges = [
      edge('START', 'EDAD'),
      edge('EDAD', 'APROBAR', { priority: 1, conditions: [{ code: 'ES_MAYOR' }] }),
      edge('EDAD', 'RECHAZAR', { priority: 2, default: true }),
    ];
    const paths = enumeratePaths(nodes, edges);

    expect(paths).toHaveLength(2);
    expect(paths.every((path) => !path.open)).toBe(true);
    expect(paths.map((path) => path.terminal)).toEqual(['APROBAR', 'RECHAZAR']);
    // La etiqueta de la rama explica POR QUÉ se tomó ese camino.
    expect(paths[0].branches).toContain('si ES_MAYOR');
    expect(paths[1].branches).toContain('si no se cumple');
  });

  it('marca el recorrido que no llega a ningún final', () => {
    // Es el agujero real: un caso que sigue ese camino se queda sin respuesta.
    const nodes = [node('START', 'START'), node('EDAD'), node('APROBAR', 'RESULT')];
    const edges = [
      edge('START', 'EDAD'),
      edge('EDAD', 'APROBAR', { priority: 1 }),
      edge('EDAD', 'HUERFANO', { priority: 2 }),
    ];
    const paths = enumeratePaths(nodes, edges);
    // El destino inexistente no produce recorrido; el que sí existe, sí.
    expect(paths.filter((path) => !path.open)).toHaveLength(1);
  });

  it('un nodo sin salida ni condición de final deja el camino abierto', () => {
    const nodes = [node('START', 'START'), node('CALCULA', 'EXPRESSION')];
    const paths = enumeratePaths(nodes, [edge('START', 'CALCULA')]);
    expect(paths).toHaveLength(1);
    expect(paths[0].open).toBe(true);
    expect(paths[0].terminal).toBeNull();
  });

  it('ordena las ramas por prioridad, no por azar', () => {
    // Dos revisiones del mismo grafo deben listar lo mismo en el mismo orden.
    const nodes = [
      node('START', 'START'),
      node('SW', 'SWITCH'),
      node('A', 'RESULT'),
      node('B', 'RESULT'),
      node('C', 'RESULT'),
    ];
    const edges = [
      edge('START', 'SW'),
      edge('SW', 'C', { priority: 3 }),
      edge('SW', 'A', { priority: 1 }),
      edge('SW', 'B', { priority: 2 }),
    ];
    expect(enumeratePaths(nodes, edges).map((path) => path.terminal)).toEqual(['A', 'B', 'C']);
  });

  it('no se cuelga con un ciclo', () => {
    const nodes = [node('START', 'START'), node('A'), node('B'), node('FIN', 'END')];
    const edges = [edge('START', 'A'), edge('A', 'B'), edge('B', 'A'), edge('A', 'FIN')];
    const paths = enumeratePaths(nodes, edges);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some((path) => path.terminal === 'FIN')).toBe(true);
  });

  it('sin nodo de inicio no hay recorrido que enumerar', () => {
    expect(enumeratePaths([node('A')], [])).toEqual([]);
  });
});
