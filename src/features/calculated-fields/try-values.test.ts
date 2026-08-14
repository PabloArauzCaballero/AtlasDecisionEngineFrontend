import { describe, expect, it } from 'vitest';
import { parseInputValues, stringifyInput } from './calculated-field-values';

const INPUTS = [
  { id: 'ingreso', dataType: 'DECIMAL' },
  { id: 'activo', dataType: 'BOOLEAN' },
  { id: 'nombre', dataType: 'STRING' },
  { id: 'notas', dataType: 'LIST' },
];

describe('valores del formulario de pruebas', () => {
  it('convierte cada casilla al tipo que declara su entrada', () => {
    expect(
      parseInputValues(INPUTS, {
        ingreso: '1200.5',
        activo: 'true',
        nombre: 'Ana',
        notas: '[1,2]',
      }),
    ).toEqual({ ingreso: 1200.5, activo: true, nombre: 'Ana', notas: [1, 2] });
  });

  it('omite las casillas vacías en vez de mandar cadenas vacías', () => {
    // Mandar `''` a una entrada opcional la haría fallar por tipo; omitirla deja que el
    // contrato aplique su valor por defecto o su política de dato ausente.
    expect(parseInputValues(INPUTS, { ingreso: '', activo: 'false' })).toEqual({ activo: false });
  });

  it('una lista mal escrita se manda tal cual, para que el motor explique el error', () => {
    expect(parseInputValues(INPUTS, { notas: '[1,' })).toEqual({ notas: '[1,' });
  });

  it('escribe un caso generado sin ponerle comillas al texto', () => {
    // `JSON.stringify('Ana')` sería `"Ana"`, y esas comillas acabarían dentro del valor.
    expect(stringifyInput({ nombre: 'Ana', ingreso: 1200, notas: [1, 2] })).toEqual({
      nombre: 'Ana',
      ingreso: '1200',
      notas: '[1,2]',
    });
  });

  it('un valor ausente deja la casilla vacía, no la palabra «null»', () => {
    // Un caso generado para una entrada opcional trae `null`. Escribirlo como texto
    // convertía «no mandes nada» en mandar `"null"`, que para un decimal llega a NaN.
    expect(stringifyInput({ ingreso: null })).toEqual({ ingreso: '' });
    expect(parseInputValues(INPUTS, stringifyInput({ ingreso: null }))).toEqual({});
  });
});
