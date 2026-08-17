import { describe, expect, it } from 'vitest';
import { columnasParaR } from './r-data';

describe('columnasParaR', () => {
  it('mantiene los números como números cuando faltan valores', () => {
    const columnas = columnasParaR(
      [{ importe: 10 }, { importe: null }, { importe: 2.5 }],
      ['importe'],
    );
    expect(columnas.importe).toEqual([10, null, 2.5]);
  });

  /**
   * El caso que motiva el módulo entero: un solo valor de texto degrada la columna, y hay que
   * poder verlo. Lo que NO puede pasar es que la degradación ocurra fila a fila dentro de R, donde
   * nadie la mide.
   */
  it('degrada a texto la columna con un valor no numérico, y lo hace ENTERA', () => {
    const columnas = columnasParaR([{ importe: 10 }, { importe: 'N/D' }], ['importe']);
    expect(columnas.importe).toEqual(['10', 'N/D']);
  });

  it('no mezcla booleanos con números: la columna se vuelve texto', () => {
    const columnas = columnasParaR([{ mixto: true }, { mixto: 3 }], ['mixto']);
    expect(columnas.mixto).toEqual(['true', '3']);
  });

  it('trata NaN e Infinity como texto, no como número', () => {
    const columnas = columnasParaR([{ v: 1 }, { v: Number.NaN }], ['v']);
    expect(columnas.v).toEqual(['1', 'NaN']);
  });

  /** `undefined` y `null` son la misma cosa para R: ausencia, no cadena vacía. */
  it('convierte ausencia en null y nunca en cadena vacía', () => {
    const columnas = columnasParaR([{ a: 'x' }, { a: null }, {}], ['a']);
    expect(columnas.a).toEqual(['x', null, null]);
  });

  it('serializa objetos y listas en vez de dejar [object Object]', () => {
    const columnas = columnasParaR([{ carga: { id: 7 } }, { carga: [1, 2] }], ['carga']);
    expect(columnas.carga).toEqual(['{"id":7}', '[1,2]']);
  });

  /** Sin filas no hay tipo que deducir: el preámbulo arma el marco desde los NOMBRES. */
  it('devuelve un objeto vacío cuando la página no trae filas', () => {
    expect(columnasParaR([], ['a', 'b'])).toEqual({});
  });

  it('ignora las claves que la fila trae y el catálogo no declara', () => {
    const columnas = columnasParaR([{ a: 1, colada: 'x' }], ['a']);
    expect(Object.keys(columnas)).toEqual(['a']);
  });

  /** Una columna declarada que ninguna fila trae sigue existiendo, entera en `NA`. */
  it('conserva la columna declarada que ninguna fila trae', () => {
    const columnas = columnasParaR([{ a: 1 }], ['a', 'ausente']);
    expect(columnas.ausente).toEqual([null]);
  });
});
