import { describe, expect, it } from 'vitest';
import { reviewReadiness } from './review-readiness';

const NODOS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const caso = { id: '1' };
const corrida = (
  status: string,
  cubiertos?: string[],
  id = '9',
  finishedAt = '2026-10-07T01:00:00Z',
) => ({
  id,
  status,
  finishedAt,
  coverage:
    cubiertos === undefined
      ? []
      : [
          {
            coverageType: 'NODE',
            detailsJson: {
              covered: cubiertos,
              missing: NODOS.filter((nodo) => !cubiertos.includes(nodo)),
            },
          },
        ],
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
    const r = reviewReadiness('8', 'COMPILED', [suite({ runs: [corrida('PASSED', NODOS)] })]);

    expect(r.ready).toBe(true);
    expect(r.items.every((item) => !item.action && !item.canGenerate)).toBe(true);
  });

  it('sin ninguna suite NO dice «ejecútalas»: dice que hay que crearlas, y ofrece generarlas', () => {
    // El caso de TEST del 2026-10-07: IDENTIDAD_CARNET_MOVIL 1.2.1, compilada y sin suites.
    const r = reviewReadiness('5', 'COMPILED', []);

    expect(r.ready).toBe(false);
    const pendiente = r.items.find((item) => !item.ok);
    expect(pendiente?.detail).toContain('no tiene ninguna suite');
    expect(pendiente?.detail).toContain('NO se heredan');
    expect(pendiente?.action).toEqual({
      label: 'Crear las pruebas a mano',
      href: '/artifact-versions/5/test-suites',
    });
    expect(pendiente?.canGenerate).toBe(true);
  });

  it('sin compilar no se ofrece generar: no hay diagrama que recorrer', () => {
    const r = reviewReadiness('5', 'VALIDATED', []);

    expect(r.items[0]).toMatchObject({
      ok: false,
      action: { href: '/artifact-versions/5/compile' },
    });
    expect(r.items[0]?.detail).toContain('Validada');
    expect(r.items.some((item) => item.canGenerate)).toBe(false);
  });

  it('con suites pero ninguna bloqueante lo dice tal cual', () => {
    const r = reviewReadiness('5', 'COMPILED', [
      suite({ isBlocking: false, runs: [corrida('PASSED', NODOS)] }),
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

  it('con una corrida en marcha lo dice y no ofrece enviar todavía', () => {
    const r = reviewReadiness('8', 'COMPILED', [suite({ runs: [corrida('QUEUED')] })]);

    expect(r.ready).toBe(false);
    expect(r.running).toBe(true);
    expect(r.items[1]?.detail).toContain('Se está ejecutando');
  });

  it('pasa pero no llega al 80 % de los nodos: nombra los que faltan, lleva a la cobertura y ofrece generar', () => {
    const r = reviewReadiness('8', 'COMPILED', [
      suite({ runs: [corrida('PASSED', NODOS.slice(0, 6))] }),
    ]);
    const cobertura = r.items.find((item) => item.key === 'coverage');

    expect(r.ready).toBe(false);
    expect(cobertura?.detail).toContain('60 %');
    expect(cobertura?.detail).toContain('G, H, I, J');
    expect(cobertura?.action?.href).toBe('/test-runs/9/coverage');
    expect(cobertura?.canGenerate).toBe(true);
  });

  it('la cobertura es del CONJUNTO: dos suites que juntas recorren el diagrama pasan', () => {
    // El motor dejó de exigir el 80 % a cada suite por separado.
    const r = reviewReadiness('8', 'COMPILED', [
      suite({ id: '6', suiteCode: 'GRANDE', runs: [corrida('PASSED', NODOS.slice(0, 6), '9')] }),
      suite({ id: '7', suiteCode: 'PUNTUAL', runs: [corrida('PASSED', NODOS.slice(6, 9), '10')] }),
    ]);

    expect(r.ready).toBe(true);
    expect(r.items.find((item) => item.key === 'coverage')?.detail).toContain('90 %');
  });

  it('manda la corrida MÁS RECIENTE, no la primera de la lista', () => {
    const vieja = corrida('PASSED', NODOS, '3', '2026-10-01T00:00:00Z');
    const item = reviewReadiness('8', 'COMPILED', [suite({ runs: [vieja, corrida('FAILED')] })])
      .items[1];

    expect(item?.ok).toBe(false);
  });

  it('los casos desactivados de una generación anterior no cuentan', () => {
    const r = reviewReadiness('8', 'COMPILED', [
      suite({
        cases: [
          { id: '1', isActive: false },
          { id: '2', isActive: true },
        ],
        runs: [corrida('PASSED', NODOS)],
      }),
    ]);

    expect(r.items[1]?.detail).toContain('1 caso(s)');
  });

  it('una suite sin casos activos no cuenta como «nunca se ejecutó»', () => {
    const item = reviewReadiness('8', 'COMPILED', [suite({ cases: [], runs: [] })]).items[1];

    expect(item?.detail).toContain('no tiene ningún caso');
  });
});
