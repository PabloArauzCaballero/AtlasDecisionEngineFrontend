import { splitPromotionTargets, type EnvironmentOption } from './promotion-targets';

const environments: EnvironmentOption[] = [
  { code: 'DEV', name: 'Development', status: 'ACTIVE', isProduction: false },
  { code: 'TEST', name: 'Test', status: 'ACTIVE', isProduction: false },
  { code: 'PROD', name: 'Producción', status: 'ACTIVE', isProduction: true },
  { code: 'OLD', name: 'Retirado', status: 'DECOMMISSIONED', isProduction: false },
];

describe('destinos de promoción', () => {
  it('oculta producción a quien no es administrador y dice cuál retuvo', () => {
    const split = splitPromotionTargets(environments, false);
    expect(split.allowed.map((environment) => environment.code)).toEqual(['DEV', 'TEST']);
    expect(split.withheldProduction.map((environment) => environment.code)).toEqual(['PROD']);
  });

  it('ofrece todo al administrador, con producción al final de la lista', () => {
    const split = splitPromotionTargets(environments, true);
    expect(split.allowed.map((environment) => environment.code)).toEqual(['DEV', 'TEST', 'PROD']);
    expect(split.withheldProduction).toEqual([]);
  });

  it('descarta los ambientes inactivos para todo el mundo', () => {
    for (const canPromoteToProduction of [true, false]) {
      const split = splitPromotionTargets(environments, canPromoteToProduction);
      expect(split.allowed.some((environment) => environment.code === 'OLD')).toBe(false);
    }
  });

  it('trata como producción el ambiente sin bandera cuyo código lo delata', () => {
    const legacy: EnvironmentOption[] = [{ code: 'PROD', name: 'Prod', status: 'ACTIVE' }];
    expect(splitPromotionTargets(legacy, false).allowed).toEqual([]);
    expect(splitPromotionTargets(legacy, false).withheldProduction).toHaveLength(1);
  });
});
