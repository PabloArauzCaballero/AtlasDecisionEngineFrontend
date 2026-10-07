import { parseJsonObject } from '../utils/json';

/**
 * Por qué este resultado esperado todavía no sirve, o `null` si ya afirma algo.
 *
 * Un caso que espera `{}` pasa con cualquier respuesta: una suite hecha de casos
 * así se ponía en verde sin comprobar nada y contaba como evidencia para revisión.
 * El motor ya los rechaza (`TEST_CASE_WITHOUT_EXPECTATION`); aquí se dice antes de
 * enviar, y con qué se arregla.
 */
export function expectationGap(text: string): string | null {
  try {
    return Object.keys(parseJsonObject(text)).length
      ? null
      : 'Falta el resultado esperado: un caso que no espera nada pasa siempre y no comprueba nada.';
  } catch {
    return 'El resultado esperado no es un objeto JSON válido.';
  }
}
