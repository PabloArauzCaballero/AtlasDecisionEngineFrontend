import { conflictingHeads, deriveEnvironmentHeads } from './environment-heads';

const deployment = (
  code: string,
  version: string,
  deployedAt: string,
  deploymentStatus = 'ACTIVE',
) => ({
  id: `${code}-${version}`,
  environment: { code },
  deploymentStatus,
  deployedAt,
  deployedBy: 'admin@atlas.bo',
  artifactVersion: { id: version, versionNumber: version, semanticVersion: `1.${version}.0` },
});

describe('deriveEnvironmentHeads', () => {
  it('devuelve el despliegue activo más reciente de cada ambiente', () => {
    const heads = deriveEnvironmentHeads([
      deployment('PROD', '4', '2026-07-01T10:00:00Z'),
      deployment('SANDBOX', '9', '2026-07-20T10:00:00Z'),
    ]);
    expect(heads.map((head) => head.environmentCode)).toEqual(['PROD', 'SANDBOX']);
    expect(heads[0].versionLabel).toBe('1.4.0');
    expect(heads[0].activeCount).toBe(1);
  });

  it('ignora los despliegues que ya no están vigentes', () => {
    const heads = deriveEnvironmentHeads([
      deployment('PROD', '4', '2026-07-01T10:00:00Z', 'SUPERSEDED'),
      deployment('PROD', '5', '2026-07-02T10:00:00Z', 'ROLLED_BACK'),
      deployment('PROD', '6', '2026-07-03T10:00:00Z'),
    ]);
    expect(heads).toHaveLength(1);
    expect(heads[0].versionId).toBe('6');
  });

  it('cuenta —y no esconde— dos versiones activas en el mismo ambiente', () => {
    const heads = deriveEnvironmentHeads([
      deployment('PROD', '7', '2026-07-01T10:00:00Z'),
      deployment('PROD', '8', '2026-07-05T10:00:00Z'),
    ]);
    expect(heads[0].activeCount).toBe(2);
    // El head mostrado es el último, pero la violación queda señalada.
    expect(heads[0].versionId).toBe('8');
    expect(conflictingHeads(heads)).toHaveLength(1);
  });

  it('acepta el código plano cuando el despliegue no anida el ambiente', () => {
    const heads = deriveEnvironmentHeads([
      {
        environmentCode: 'TEST',
        status: 'ACTIVE',
        artifactVersion: { id: '3', versionNumber: '3' },
      },
    ]);
    expect(heads[0].environmentCode).toBe('TEST');
    expect(heads[0].versionLabel).toBe('3');
  });

  it('un despliegue sin ambiente no produce un head fantasma', () => {
    expect(deriveEnvironmentHeads([{ deploymentStatus: 'ACTIVE' }])).toEqual([]);
  });

  it('sin despliegues no hay nada vigente', () => {
    expect(deriveEnvironmentHeads([])).toEqual([]);
    expect(conflictingHeads([])).toEqual([]);
  });
});
