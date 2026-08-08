import { sampleKindForSuite, SUITE_TYPES, suiteType } from './suite-types';

describe('tipos de suite', () => {
  it('usa el vocabulario que publica el motor', () => {
    // El formulario ofrecía «SMOKE» y «VALIDATION», que el contrato del motor no
    // nombra: `suiteType` es texto libre, así que se guardaban sin error y luego
    // no coincidían con nada de lo que el propio motor documenta.
    expect(SUITE_TYPES.map((type) => type.code)).toEqual(['REGRESSION', 'GOLDEN', 'GENERATED']);
  });

  it('siembra la regresión con entradas válidas y el barrido en el límite', () => {
    expect(sampleKindForSuite('REGRESSION')).toBe('VALID');
    expect(sampleKindForSuite('GOLDEN')).toBe('VALID');
    // Los defectos viven en los límites del contrato: un barrido de casos
    // cómodos no encuentra nada.
    expect(sampleKindForSuite('GENERATED')).toBe('BOUNDARY');
  });

  it('cada tipo explica para qué sirve y por qué se siembra así', () => {
    for (const type of SUITE_TYPES) {
      expect(type.purpose.length).toBeGreaterThan(20);
      expect(type.kindReason.length).toBeGreaterThan(20);
    }
  });

  it('un tipo desconocido cae en el más conservador, no revienta', () => {
    // Una suite guardada con un tipo antiguo debe seguir abriéndose.
    expect(suiteType('SMOKE').code).toBe('REGRESSION');
    expect(sampleKindForSuite('SMOKE')).toBe('VALID');
  });
});
