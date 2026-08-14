import { buildDiffBases } from './diff-bases';
import type { EnvironmentHead } from './environment-heads';

const head = (environmentCode: string, versionId: string): EnvironmentHead => ({
  environmentCode,
  versionId,
  versionLabel: `1.${versionId}.0`,
  deployedAt: '2026-07-01T10:00:00Z',
  deployedBy: 'admin@atlas.bo',
  activeCount: 1,
});

describe('buildDiffBases', () => {
  it('propone el origen primero y luego lo vigente en cada ambiente', () => {
    const { bases } = buildDiffBases({
      versionId: '9',
      sourceVersionId: '8',
      heads: [head('PROD', '5'), head('DEV', '7')],
    });
    expect(bases.map((base) => base.versionId)).toEqual(['8', '5', '7']);
    expect(bases[0].label).toBe('Versión de origen');
    expect(bases[1].label).toBe('Vigente en PROD');
  });

  it('nunca compara una versión contra sí misma', () => {
    const { bases } = buildDiffBases({
      versionId: '9',
      sourceVersionId: '9',
      heads: [head('PROD', '9')],
    });
    expect(bases).toEqual([]);
  });

  it('no repite una referencia que ya es el origen', () => {
    const { bases } = buildDiffBases({
      versionId: '9',
      sourceVersionId: '5',
      heads: [head('PROD', '5')],
    });
    expect(bases).toHaveLength(1);
    expect(bases[0].versionId).toBe('5');
  });

  it('avisa cuando el ambiente avanzó por debajo de la propuesta', () => {
    const { movedAhead } = buildDiffBases({
      versionId: '9',
      sourceVersionId: '4',
      heads: [head('PROD', '6'), head('DEV', '4')],
    });
    expect(movedAhead.map((entry) => entry.environmentCode)).toEqual(['PROD']);
  });

  it('sin origen declarado no se puede afirmar que el objetivo avanzó', () => {
    const { bases, movedAhead } = buildDiffBases({
      versionId: '9',
      sourceVersionId: null,
      heads: [head('PROD', '6')],
    });
    expect(movedAhead).toEqual([]);
    expect(bases.map((base) => base.versionId)).toEqual(['6']);
  });

  it('un artefacto sin despliegues ni origen no ofrece comparación', () => {
    const { bases, movedAhead } = buildDiffBases({
      versionId: '9',
      sourceVersionId: null,
      heads: [],
    });
    expect(bases).toEqual([]);
    expect(movedAhead).toEqual([]);
  });
});
