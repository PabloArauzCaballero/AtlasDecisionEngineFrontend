import { describe, expect, it } from 'vitest';
import { toCsv } from './download';

const COLUMNS = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Nombre' },
];

describe('toCsv', () => {
  it('escapa comas, comillas y saltos de línea sin alterar el valor', () => {
    const csv = toCsv([{ code: 'A,1', name: 'Dice "hola"' }], COLUMNS);
    expect(csv).toBe('Código,Nombre\r\n"A,1","Dice ""hola"""');
  });

  /*
   * Una celda que empieza por `=`, `+`, `-` o `@` la ejecuta la hoja de cálculo
   * al abrir el archivo, y `downloadCsv` antepone un BOM justamente para que se
   * abra en Excel. El valor viene del motor y de catálogos que edita un usuario,
   * así que la exportación es una vía de ejecución si no se neutraliza.
   */
  it.each([
    ['=1+1', "'=1+1"],
    ['+1', "'+1"],
    ['-1', "'-1"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tcmd', "'\tcmd"],
  ])('desactiva la fórmula %j', (input, expected) => {
    // Sin entrecomillar: ninguno de estos rompe la ESTRUCTURA del CSV —el
    // tabulador tampoco—, así que basta con la marca de texto.
    expect(toCsv([{ code: input, name: 'x' }], COLUMNS)).toBe(`Código,Nombre\r\n${expected},x`);
  });

  it('marca como texto la fórmula que además necesita entrecomillado', () => {
    // La marca va DENTRO de las comillas: fuera formaría parte del delimitador.
    expect(toCsv([{ code: '=HYPERLINK("http://x","c")', name: 'x' }], COLUMNS)).toBe(
      'Código,Nombre\r\n"\'=HYPERLINK(""http://x"",""c"")",x',
    );
  });

  it('no toca un valor que solo CONTIENE un signo igual', () => {
    expect(toCsv([{ code: 'a=b', name: 'x' }], COLUMNS)).toBe('Código,Nombre\r\na=b,x');
  });

  it('también protege la fila de cabecera', () => {
    expect(toCsv([], [{ key: 'k', label: '=1+1' }])).toBe("'=1+1");
  });

  it('serializa nulos como celda vacía y objetos como JSON', () => {
    const csv = toCsv([{ code: null, name: { a: 1 } }], COLUMNS);
    expect(csv).toBe('Código,Nombre\r\n,"{""a"":1}"');
  });
});
