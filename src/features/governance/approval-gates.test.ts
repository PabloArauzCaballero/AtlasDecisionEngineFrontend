import { isPassingGate, readGates } from './approval-gates';

describe('readGates', () => {
  it('no inventa gates cuando el backend no manda ninguno', () => {
    const report = readGates({ id: '1' }, { id: '9' });
    expect(report.reported).toBe(false);
    expect(report.rows).toEqual([]);
    expect(report.failing).toEqual([]);
  });

  it('lee los resultados reales y marca los que no aprobaron', () => {
    const report = readGates({
      gates: [
        { id: 'compile', name: 'Compilación determinista', status: 'PASSED' },
        { id: 'suite', name: 'Suite bloqueante', status: 'FAILED', detail: '2 casos rojos' },
      ],
    });
    expect(report.reported).toBe(true);
    expect(report.rows).toHaveLength(2);
    expect(report.failing.map((row) => row.key)).toEqual(['suite']);
    expect(report.rows[1].detail).toBe('2 casos rojos');
  });

  it('un gate sin estado no cuenta como aprobado', () => {
    const report = readGates({ checks: [{ name: 'Cobertura' }] });
    expect(report.rows[0].status).toBeNull();
    expect(report.failing).toHaveLength(1);
  });

  it('busca en la versión cuando la solicitud no trae gates', () => {
    const report = readGates({ id: '1' }, { qualityGates: [{ name: 'Integridad', result: 'OK' }] });
    expect(report.reported).toBe(true);
    expect(report.failing).toEqual([]);
  });
});

describe('isPassingGate', () => {
  it('sólo da por bueno lo que declara aprobación', () => {
    expect(isPassingGate('passed')).toBe(true);
    expect(isPassingGate('SUCCESS')).toBe(true);
    expect(isPassingGate('PENDING')).toBe(false);
    expect(isPassingGate(null)).toBe(false);
  });
});
