import { describe, expect, it } from 'vitest';
import { reviewReadiness } from './review-readiness';

const caso = { id: '1' };
const corrida = (status: string, cobertura?: number, missing: string[] = []) => ({
  id: '9',
  status,
  finishedAt: '2026-10-07T01:00:00Z',
  coverage:
    cobertura === undefined
      ? []
      : [{ coverageType: 'NODE', coveragePercentage: String(cobertura), detailsJson: { missing } }],
});
const suite = (extra: Record<string, unknown>) => ({
  id: '6',
  suiteCode: 'DESENLACES',
  isBlocking: true,
  cases: [caso],
  ...extra,
});

describe('qué le falta a una versión para enviarse a revisión', () => {
  it('compilada y con su suite bloqueante en verde y bien cubierta: lista', () => {
    const r = reviewReadiness('8', 'COMPILED', [suite({ runs: [corrida('PASSED', 100)] })]);

    expect(r.ready).toBe(true);
    expect(r.items.every((item) => !item.action)).toBe(true);
  });

  it('sin ninguna suite NO dice «ejecútalas»: dice que hay que crearlas y lleva a las pruebas de esa versión', () => {
    // El caso de TEST del 2026-10-07: IDENTIDAD_CARNET_MOVIL 1.2.1, compilada y sin suites.
    const r = reviewReadiness('5', 'COMPILED', []);

    expect(r.ready).toBe(false);
    const pendiente = r.items.find((item) => !item.ok);
    expect(pendiente?.detail).toContain('no tiene ninguna suite');
    expect(pendiente?.detail).toContain('NO se heredan');
    expect(pendiente?.action).toEqual({
      label: 'Crear las pruebas de esta versión',
      href: '/artifact-versions/5/test-suites',
    });
  });

  it('con suites pero ninguna bloqueante lo dice tal cual', () => {
    const r = reviewReadiness('5', 'COMPILED', [
      suite({ isBlocking: false, runs: [corrida('PASSED', 100)] }),
    ]);

    expect(r.items.find((item) => !item.ok)?.detail).toContain(
      'ninguna está marcada como bloqueante',
    );
  });

  it('una suite que nunca corrió lleva a ejecutarla; una que falló, a ver qué casos fallaron', () => {
    const nunca = reviewReadiness('8', 'COMPILED', [suite({ runs: [] })]).items[1];
    expect(nunca?.detail).toContain('nunca se ejecutó');
    expect(nunca?.action?.href).toBe('/test-suites/6/cases');

    const fallo = reviewReadiness('8', 'COMPILED', [suite({ runs: [corrida('FAILED')] })]).items[1];
    expect(fallo?.detail).toContain('no pasó');
    expect(fallo?.action).toEqual({ label: 'Ver qué casos fallaron', href: '/test-runs/9' });
  });

  it('pasa pero no llega al 80 % de los nodos: nombra los que faltan y lleva a la cobertura', () => {
    const item = reviewReadiness('8', 'COMPILED', [
      suite({ runs: [corrida('PASSED', 62, ['RECHAZAR', 'REVISAR'])] }),
    ]).items[1];

    expect(item?.ok).toBe(false);
    expect(item?.detail).toContain('62 %');
    expect(item?.detail).toContain('RECHAZAR, REVISAR');
    expect(item?.action?.href).toBe('/test-runs/9/coverage');
  });

  it('manda la corrida MÁS RECIENTE, no la primera de la lista', () => {
    const vieja = { ...corrida('PASSED', 100), id: '3', finishedAt: '2026-10-01T00:00:00Z' };
    const item = reviewReadiness('8', 'COMPILED', [suite({ runs: [vieja, corrida('FAILED')] })])
      .items[1];

    expect(item?.ok).toBe(false);
  });

  it('sin compilar, lo primero es compilar, con su enlace', () => {
    const r = reviewReadiness('5', 'VALIDATED', []);

    expect(r.items[0]).toMatchObject({
      ok: false,
      action: { href: '/artifact-versions/5/compile' },
    });
    expect(r.items[0]?.detail).toContain('Validada');
  });

  it('una suite sin casos no cuenta como «nunca se ejecutó»', () => {
    const item = reviewReadiness('8', 'COMPILED', [suite({ cases: [], runs: [] })]).items[1];

    expect(item?.detail).toContain('no tiene ningún caso');
  });
});
