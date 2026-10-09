import { celdaCsv, partirLinea } from './category-csv';

/**
 * El catálogo y la bandeja se bajan como CSV, se editan en una hoja y se vuelven a subir. Las
 * glosas bancarias las escribe un tercero: una que empiece por `=` no puede ejecutarse al abrir
 * el archivo, y la marca que lo impide no puede quedarse pegada al valor al volver.
 */
describe('celdaCsv', () => {
  it('neutraliza una fórmula dentro del entrecomillado', () => {
    expect(celdaCsv('=HYPERLINK("https://x")')).toBe(`"'=HYPERLINK(""https://x"")"`);
    expect(celdaCsv('-GASTO')).toBe(`"'-GASTO"`);
  });

  it('deja igual el texto normal y los números', () => {
    expect(celdaCsv('PAGO, CONSULTA')).toBe('"PAGO, CONSULTA"');
    expect(celdaCsv(-0.5)).toBe('-0.5');
    expect(celdaCsv(null)).toBe('');
  });

  it('lo que baja neutralizado vuelve a subir como se escribió', () => {
    const linea = [celdaCsv('7'), celdaCsv('=1+1'), celdaCsv('@SUMA(A1)'), celdaCsv("'cita")].join(
      ',',
    );
    expect(partirLinea(linea)).toEqual(['7', '=1+1', '@SUMA(A1)', "'cita"]);
  });
});
