import { diffGraphs, groupByCollection } from './version-diff';

const base = {
  nodes: [
    { key: 'INICIO', type: 'START', label: 'Inicio', x: 10, y: 10 },
    { key: 'EVAL_SCORE', type: 'CONDITION', label: 'Evalúa score', config: { min: 550 }, x: 10 },
    { key: 'RECHAZO', type: 'RESULT', label: 'Rechazar' },
  ],
  edges: [{ key: 'E1', from: 'INICIO', to: 'EVAL_SCORE', priority: 1 }],
  actions: [{ code: 'NOTIFICAR', type: 'WEBHOOK', payload: { url: 'https://a.test' } }],
};

const target = {
  nodes: [
    { key: 'INICIO', type: 'START', label: 'Inicio', x: 10, y: 10 },
    { key: 'EVAL_SCORE', type: 'CONDITION', label: 'Evalúa buró', config: { min: 600 }, x: 40 },
    { key: 'REVISION', type: 'RESULT', label: 'Revisión manual' },
  ],
  edges: [{ key: 'E1', from: 'INICIO', to: 'REVISION', priority: 1 }],
  actions: [{ code: 'NOTIFICAR', type: 'WEBHOOK', payload: { url: 'https://a.test' } }],
};

describe('diffGraphs', () => {
  const diff = diffGraphs(base, target);

  it('empareja por identificador estable, no por posición en el arreglo', () => {
    const changed = diff.entries.filter((entry) => entry.path.startsWith('nodes.EVAL_SCORE'));
    expect(changed.map((entry) => entry.field).sort()).toEqual(['config', 'label', 'x']);
    const label = changed.find((entry) => entry.field === 'label');
    expect(label?.before).toBe('Evalúa score');
    expect(label?.after).toBe('Evalúa buró');
  });

  it('detecta altas y bajas de nodos', () => {
    expect(diff.entries).toContainEqual(
      expect.objectContaining({ path: 'nodes.REVISION', kind: 'added' }),
    );
    expect(diff.entries).toContainEqual(
      expect.objectContaining({ path: 'nodes.RECHAZO', kind: 'removed' }),
    );
  });

  it('sigue el cambio de destino de una conexión', () => {
    expect(diff.entries).toContainEqual(
      expect.objectContaining({
        path: 'edges.E1.to',
        kind: 'changed',
        before: 'EVAL_SCORE',
        after: 'REVISION',
      }),
    );
  });

  it('no reporta lo que no cambió', () => {
    expect(diff.entries.some((entry) => entry.path.startsWith('actions.'))).toBe(false);
    expect(diff.entries.some((entry) => entry.path.startsWith('nodes.INICIO'))).toBe(false);
  });

  it('marca como cosmético lo que sólo mueve el dibujo, sin ocultarlo', () => {
    const moved = diff.entries.find((entry) => entry.path === 'nodes.EVAL_SCORE.x');
    expect(moved?.cosmetic).toBe(true);
    expect(diff.substantive).not.toContainEqual(
      expect.objectContaining({ path: 'nodes.EVAL_SCORE.x' }),
    );
    expect(diff.substantive.length).toBeLessThan(diff.entries.length);
  });

  it('cuenta cada tipo de cambio', () => {
    expect(diff.counts.added).toBe(1);
    expect(diff.counts.removed).toBe(1);
    expect(diff.counts.changed).toBeGreaterThan(0);
  });

  it('dos grafos idénticos no producen cambios', () => {
    expect(diffGraphs(base, base).entries).toEqual([]);
  });

  it('señala cuando no hay nada comparable en vez de fingir un diff vacío', () => {
    expect(diffGraphs({}, {}).empty).toBe(true);
    expect(diffGraphs(base, target).empty).toBe(false);
  });

  it('sobrevive a respuestas nulas o inesperadas', () => {
    expect(diffGraphs(null, undefined).entries).toEqual([]);
    expect(diffGraphs('texto', 42).empty).toBe(true);
  });

  it('compara variables e intermedias por su código de dominio', () => {
    const withVariables = diffGraphs(
      { variables: [{ code: 'ingreso', usageType: 'INPUT', required: true }] },
      { variables: [{ code: 'ingreso', usageType: 'INPUT', required: false }] },
    );
    expect(withVariables.entries).toContainEqual(
      expect.objectContaining({ path: 'variables.ingreso.required', kind: 'changed' }),
    );
  });
});

describe('groupByCollection', () => {
  it('agrupa por colección y omite las que no cambiaron', () => {
    const groups = groupByCollection(diffGraphs(base, target));
    expect(groups.map((group) => group.label)).toEqual(['Nodos', 'Conexiones']);
    expect(groups[0].entries.every((entry) => entry.collection === 'nodes')).toBe(true);
  });
});
