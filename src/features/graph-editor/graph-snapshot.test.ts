import { withoutNode } from './graph-snapshot';
import { asRows, display } from '../../utils/records';

/**
 * Grafo de ejemplo: dos nodos de condición que comparten una condición, uno con
 * la suya propia, y un contrato de salida que publica un campo desde cada uno.
 */
function sampleGraph() {
  return {
    nodes: [
      { key: 'INICIO', type: 'START' },
      { key: 'EDAD', type: 'CONDITION', config: { conditionCode: 'EDAD_COND' } },
      { key: 'DEUDA', type: 'CONDITION', config: { conditionCode: 'COMPARTIDA' } },
      { key: 'SCORE', type: 'CONDITION', config: { conditionCode: 'COMPARTIDA' } },
    ],
    edges: [
      { key: 'E1', from: 'INICIO', to: 'EDAD' },
      { key: 'E2', from: 'EDAD', to: 'DEUDA', conditions: [{ code: 'EDAD_COND' }] },
      { key: 'E3', from: 'DEUDA', to: 'SCORE' },
    ],
    conditions: [
      { code: 'EDAD_COND', name: 'Mayor de edad' },
      { code: 'COMPARTIDA', name: 'Usada por dos nodos' },
    ],
    outputContract: [
      { code: 'decision', sourceKind: 'NODE', sourceRef: 'EDAD' },
      { code: 'riesgo', sourceKind: 'NODE', sourceRef: 'SCORE' },
      { code: 'traza', sourceKind: 'INTERMEDIATE', sourceRef: 'EDAD' },
    ],
  };
}

const codes = (rows: unknown) => asRows(rows).map((row) => display(row, 'code'));

describe('borrar un nodo del grafo', () => {
  it('se lleva el nodo y sus aristas', () => {
    const next = withoutNode(sampleGraph(), 'EDAD');

    expect(asRows(next.nodes).map((n) => display(n, 'key'))).toEqual(['INICIO', 'DEUDA', 'SCORE']);
    // E1 llegaba al nodo y E2 salía de él: las dos sobran.
    expect(asRows(next.edges).map((e) => display(e, 'key'))).toEqual(['E3']);
  });

  it('se lleva la condición que sólo usaba ese nodo', () => {
    const next = withoutNode(sampleGraph(), 'EDAD');

    // Antes se quedaba en `conditions` y viajaba al backend en el siguiente
    // guardado, describiendo una regla que ya no aplica nadie.
    expect(codes(next.conditions)).toEqual(['COMPARTIDA']);
  });

  it('NO se lleva una condición que otro nodo sigue usando', () => {
    const next = withoutNode(sampleGraph(), 'DEUDA');

    // SCORE sigue apuntando a COMPARTIDA: borrarla rompería un nodo sano, que
    // es bastante peor que dejar una condición de sobra.
    expect(codes(next.conditions)).toContain('COMPARTIDA');
  });

  it('desengancha el campo del contrato que salía del nodo borrado', () => {
    const fields = asRows(withoutNode(sampleGraph(), 'EDAD').outputContract);

    expect(fields.find((f) => display(f, 'code') === 'decision')?.sourceRef).toBe('');
    // El resto no se toca: ni el que sale de otro nodo…
    expect(fields.find((f) => display(f, 'code') === 'riesgo')?.sourceRef).toBe('SCORE');
    // …ni el que coincide en nombre pero viene de una variable intermedia.
    expect(fields.find((f) => display(f, 'code') === 'traza')?.sourceRef).toBe('EDAD');
  });

  it('conserva el campo en la lista en vez de borrarlo', () => {
    // Si desapareciera, el hueco no se vería en el panel y se publicaría una
    // versión a la que le falta una salida sin que nadie lo haya decidido.
    expect(asRows(withoutNode(sampleGraph(), 'EDAD').outputContract)).toHaveLength(3);
  });

  it('devuelve el grafo intacto si la clave no existe', () => {
    const graph = sampleGraph();
    expect(withoutNode(graph, 'NO_EXISTE')).toBe(graph);
  });
});
