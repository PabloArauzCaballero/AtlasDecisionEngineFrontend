import { configFromArchive, fakerNoteOf, runFailureOf } from './qa-run-archive';
import { leerPropiedades } from './qa-properties';

describe('lo que una corrida archivada dice de sí misma', () => {
  it('rehace la configuración completa, con los pesos originales y sin ambiente', () => {
    const config = configFromArchive(
      {
        caseCount: 500,
        environmentCode: 'EN_PROCESO',
        mix: { validPercent: 70, boundaryPercent: 20, invalidPercent: 10 },
        outcomeWeights: { APROBADO: 3, RECHAZADO: 1 },
        outcomeAllocation: { APROBADO: 263, RECHAZADO: 87 },
        distributions: { ingreso: { shape: 'HIGH_TAIL' } },
        stopOnFirstFailure: true,
      },
      'qa-base',
    );
    expect(config).toMatchObject({
      caseCount: 500,
      seed: 'qa-base',
      validPercent: 70,
      boundaryPercent: 20,
      invalidPercent: 10,
      outcomeWeights: { APROBADO: 3, RECHAZADO: 1 },
      distributions: [{ variableCode: 'ingreso', shape: 'HIGH_TAIL' }],
      stopOnFirstFailure: true,
      coverOutcomes: true,
    });
    expect(config).not.toHaveProperty('environmentCode');
  });

  it('una corrida abandonada sin motivo archivado se explica igual', () => {
    expect(runFailureOf({ status: 'FAILED', summary: null })?.title).toMatch(/sin terminar/);
    expect(runFailureOf({ status: 'COMPLETED' })).toBeNull();
  });

  it('dice de dónde salieron los datos', () => {
    expect(fakerNoteOf({ source: 'mock', mappedVariables: { ci: 'x' } })?.text).toMatch(
      /generador de datos realistas/,
    );
    expect(fakerNoteOf({ source: 'local-fallback', reason: 'caído.' })?.tone).toBe('warning');
    expect(fakerNoteOf(null)).toBeNull();
  });
});

describe('el catálogo de propiedades del motor', () => {
  it('lee los códigos sueltos que publicaba el motor, en vez de descartarlos', () => {
    expect(leerPropiedades({ items: ['DETERMINISM', 'NUEVA_PROPIEDAD'] })).toEqual([
      { code: 'DETERMINISM', label: 'La misma entrada da el mismo resultado' },
      { code: 'NUEVA_PROPIEDAD', label: 'NUEVA_PROPIEDAD' },
    ]);
  });

  it('y los objetos con etiqueta y explicación que publica ahora', () => {
    expect(
      leerPropiedades({
        items: [{ code: 'DETERMINISM', label: 'Repetible', description: 'Dos veces igual.' }],
      }),
    ).toEqual([{ code: 'DETERMINISM', label: 'Repetible', description: 'Dos veces igual.' }]);
  });
});
