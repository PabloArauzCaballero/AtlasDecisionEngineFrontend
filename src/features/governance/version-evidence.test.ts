import { isPassingGate } from './approval-gates';
import { evidenceGateRows } from './version-evidence';

/**
 * Estas pruebas vigilan una sola cosa: que la pantalla de aprobación no afirme
 * nada que el motor no haya dicho. Firmar es irreversible y queda en la
 * bitácora con el nombre de quien firma, así que una evidencia optimista es
 * peor que ninguna evidencia.
 */
describe('evidenceGateRows', () => {
  it('no emite ninguna fila cuando no hay evidencia', () => {
    expect(evidenceGateRows({ id: '55' }, [])).toEqual([]);
  });

  it('NO toma el checksum de la versión por una compilación aprobada', () => {
    // `canonicalChecksum` es la forma canónica del grafo: existe también en un
    // borrador que nunca pasó por el compilador.
    const rows = evidenceGateRows(
      { id: '55', canonicalChecksum: 'abc123', checksum: 'abc123' },
      [],
    );
    expect(rows).toEqual([]);
  });

  it('emite la compilación con el estado que reportó el compilador', () => {
    const rows = evidenceGateRows(
      {
        id: '55',
        compiledArtifacts: [
          { id: '3', compileStatus: 'SUCCESS', compilerVersion: '2.1.0' },
          { id: '2', compileStatus: 'FAILED', compilerVersion: '2.0.0' },
        ],
      },
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Compilación determinista');
    // La más reciente es la primera: el backend las ordena por `compiledAt` desc.
    expect(rows[0].status).toBe('SUCCESS');
    expect(rows[0].detail).toBe('compilador 2.1.0');
  });

  it('una compilación fallida se propaga tal cual y no aprueba', () => {
    const rows = evidenceGateRows(
      { id: '55', compiledArtifacts: [{ id: '3', compileStatus: 'FAILED' }] },
      [],
    );
    expect(rows[0].status).toBe('FAILED');
    expect(isPassingGate(rows[0].status)).toBe(false);
  });

  it('una suite sin corridas queda «SIN CORRIDA», que no es aprobación', () => {
    const rows = evidenceGateRows({ id: '55' }, [
      { id: '9', suiteCode: 'REGRESION', isBlocking: true, cases: [{ id: 'c1' }], runs: [] },
    ]);
    expect(rows[0].status).toBe('SIN CORRIDA');
    expect(isPassingGate(rows[0].status)).toBe(false);
    expect(rows[0].detail).toContain('Suite bloqueante');
    expect(rows[0].detail).toContain('1 caso');
    expect(rows[0].detail).toContain('sin corridas registradas');
  });

  it('toma la corrida más reciente aunque lleguen desordenadas', () => {
    const rows = evidenceGateRows({ id: '55' }, [
      {
        id: '9',
        suiteCode: 'REGRESION',
        isBlocking: true,
        runs: [
          { id: '70', status: 'FAILED', finishedAt: '2026-07-01T10:00:00Z' },
          { id: '77', status: 'PASSED', finishedAt: '2026-08-01T10:00:00Z' },
          { id: '74', status: 'ERROR', finishedAt: '2026-07-15T10:00:00Z' },
        ],
      },
    ]);
    expect(rows[0].status).toBe('PASSED');
    expect(rows[0].detail).toContain('corrida 77');
  });

  it('pone las suites bloqueantes primero: son las que impiden firmar', () => {
    const rows = evidenceGateRows({ id: '55' }, [
      { id: '1', suiteCode: 'INFORMATIVA', isBlocking: false, runs: [] },
      { id: '2', suiteCode: 'BLOQUEANTE', isBlocking: true, runs: [] },
    ]);
    expect(rows.map((row) => row.label)).toEqual(['BLOQUEANTE', 'INFORMATIVA']);
    expect(rows[1].detail).toContain('Suite informativa');
  });

  it('la compilación va antes que las suites', () => {
    const rows = evidenceGateRows({ id: '55', compiledArtifacts: [{ compileStatus: 'SUCCESS' }] }, [
      { id: '2', suiteCode: 'BLOQUEANTE', isBlocking: true, runs: [] },
    ]);
    expect(rows.map((row) => row.key)).toEqual(['compilation', 'suite-2']);
  });

  it('una suite sin código legible no se queda sin nombre', () => {
    const rows = evidenceGateRows({ id: '55' }, [{ id: '', runs: [] }]);
    expect(rows[0].label).toBe('Suite 1');
    expect(rows[0].key).toBe('suite-0');
  });

  /*
   * `display()` devuelve «—» cuando no hay dato, y «—» es una cadena con
   * contenido: con un `||` ingenuo, dos suites sin id compartían la clave
   * `suite-—` y React las trataba como la misma fila.
   */
  it('dos suites sin id no comparten clave', () => {
    const rows = evidenceGateRows({ id: '55' }, [{ runs: [] }, { runs: [] }]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });
});
