/**
 * Tipos de suite y qué entrada de ejemplo corresponde a cada uno.
 *
 * El vocabulario es el que publica el motor (`REGRESSION`, `GOLDEN`,
 * `GENERATED`). El formulario ofrecía «Smoke» y «Validación», que el contrato
 * del motor no nombra: `suiteType` es un texto libre, así que se guardaban sin
 * error y luego no coincidían con nada de lo que el propio motor documenta.
 *
 * El tipo además decide con qué valores se rellena un caso nuevo. No es un
 * detalle cosmético: una suite de regresión que se siembra con entradas
 * inválidas no prueba lo que dice probar, y una generada que sólo trae casos
 * cómodos no encuentra nada —los defectos viven en los límites del contrato—.
 */

/**
 * Clases de entrada que sabe generar el QA Lab.
 *
 * Las tres primeras describen la ENTRADA; `OUTCOMES` describe el FINAL: pide una
 * entrada por cada desenlace del grafo, que es lo que hace falta para que una suite
 * afirme algo sobre cada decisión que el algoritmo puede tomar.
 */
export type SampleKind = 'VALID' | 'BOUNDARY' | 'INVALID' | 'OUTCOMES';

export interface SuiteType {
  code: string;
  label: string;
  /** Para qué sirve esta suite, en una línea. */
  purpose: string;
  /** Con qué se siembra un caso nuevo, y por qué. */
  defaultKind: SampleKind;
  kindReason: string;
}

export const SUITE_TYPES: readonly SuiteType[] = [
  {
    code: 'REGRESSION',
    label: 'Regresión',
    purpose: 'Lo que ya funcionaba y debe seguir funcionando en cada versión.',
    defaultKind: 'VALID',
    kindReason:
      'Una regresión afirma que un caso legítimo sigue decidiéndose igual, así que se siembra con entradas válidas.',
  },
  {
    code: 'GOLDEN',
    label: 'De referencia (golden)',
    purpose: 'Casos acordados con negocio que fijan cuál es la respuesta correcta.',
    defaultKind: 'VALID',
    kindReason:
      'Un caso de referencia describe una situación real: la entrada es válida y lo que se discute es el resultado esperado.',
  },
  {
    code: 'GENERATED',
    label: 'Generada del contrato',
    purpose: 'Barrido automático del contrato para descubrir lo que nadie pensó probar.',
    defaultKind: 'BOUNDARY',
    kindReason:
      'Se siembra en el límite del contrato: es donde aparecen los defectos, y un barrido de casos cómodos no encuentra nada.',
  },
];

const BY_CODE = new Map(SUITE_TYPES.map((type) => [type.code, type]));

/** Descriptor del tipo elegido; cae en Regresión si llega uno desconocido. */
export function suiteType(code: string): SuiteType {
  return BY_CODE.get(code) ?? SUITE_TYPES[0];
}

/** Con qué clase de valores se siembra un caso nuevo de esta suite. */
export function sampleKindForSuite(code: string): SampleKind {
  return suiteType(code).defaultKind;
}
