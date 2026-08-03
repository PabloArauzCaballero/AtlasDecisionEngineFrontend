import { describe, expect, it } from 'vitest';
import { summarizeOperation } from './operation-summary';

/**
 * Sin este resumen, abrir una versión hecha con el constructor visual no enseñaba
 * NADA de la fórmula: sólo metadatos. Lo que se prueba es que el árbol se lea
 * entero, incluidas las operaciones anidadas.
 */
describe('summarizeOperation', () => {
  it('describe una operación simple con sus entradas', () => {
    expect(
      summarizeOperation({
        operation: 'divide',
        args: [{ input: 'deuda_mensual' }, { input: 'ingreso_mensual' }],
      }),
    ).toBe('divide(deuda_mensual, ingreso_mensual)');
  });

  it('desciende por las operaciones anidadas y muestra los valores fijos', () => {
    expect(
      summarizeOperation({
        operation: 'multiply',
        args: [
          { operation: 'divide', args: [{ input: 'deuda' }, { input: 'ingreso' }] },
          { literal: 100 },
        ],
      }),
    ).toBe('multiply(divide(deuda, ingreso), 100)');
  });
});
