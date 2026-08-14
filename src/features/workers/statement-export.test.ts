import { statementToCsv, statementToJson } from './statement-export';
import { claveMovimiento, type VeredictoCategoria } from './useStatementCategories';

/**
 * Lo que se descarga tiene que decir lo mismo que la pantalla.
 *
 * Un archivo que se abre fuera del portal es la única versión del dato que
 * sobrevive a la sesión: si asciende un veredicto dudoso, o si el resumen no
 * separa lo que entra de lo que sale, el error viaja a la hoja de cálculo de
 * otro y allí ya nadie puede contrastarlo con la tabla.
 */

function veredicto(categoria: string, ruta: string[], estado = 'MATCH'): VeredictoCategoria {
  return { fase: 'listo', estado, categoria, ruta, confianza: 0.91 };
}

const veredictos: Record<string, VeredictoCategoria> = {
  [claveMovimiento({ descripcion: 'SUELDO', movementType: 'CREDIT' })]: veredicto(
    'INGRESOS.SUELDO',
    ['Ingresos', 'Sueldo'],
  ),
  [claveMovimiento({ descripcion: 'ALQUILER', movementType: 'DEBIT' })]: veredicto(
    'GASTOS.VIVIENDA.ALQUILER',
    ['Gastos', 'Vivienda', 'Alquiler'],
  ),
  [claveMovimiento({ descripcion: 'CAFE', movementType: 'DEBIT' })]: veredicto('GASTOS.CAFE', [
    'Gastos',
    'Cafetería',
  ]),
  [claveMovimiento({ descripcion: 'RARO', movementType: 'DEBIT' })]: veredicto(
    'GASTOS.VARIOS',
    ['Gastos', 'Varios'],
    'AMBIGUOUS',
  ),
};

const result = {
  transactions: [
    {
      index: 1,
      transactionDate: '2026-04-01',
      description: 'SUELDO',
      movementType: 'CREDIT',
      amount: 7000,
      balance: 7000,
    },
    {
      index: 2,
      transactionDate: '2026-04-02',
      description: 'ALQUILER',
      movementType: 'DEBIT',
      amount: -3000,
      balance: 4000,
    },
    {
      index: 3,
      transactionDate: '2026-04-03',
      description: 'CAFE',
      movementType: 'DEBIT',
      amount: -20,
      balance: 3980,
    },
    {
      index: 4,
      transactionDate: '2026-04-04',
      description: 'RARO',
      movementType: 'DEBIT',
      amount: -5,
      balance: 3975,
    },
  ],
};

describe('CSV con categorías', () => {
  const csv = statementToCsv(result, veredictos);

  it('abre con el resumen separado en ingresos y gastos', () => {
    expect(csv).toContain('RESUMEN POR CATEGORIA');
    expect(csv).toContain('"Ingresos","TOTAL","",1,7000');
    expect(csv).toContain('"Gastos","TOTAL","",3,3025');
  });

  it('lista los gastos de mayor a menor: el principal va primero', () => {
    const gastos = csv
      .split('\r\n')
      .filter((linea) => linea.startsWith('"Gastos","') && !linea.includes('"TOTAL"'))
      .map((linea) => linea.split(',')[1]);
    expect(gastos).toEqual(['"GASTOS.VIVIENDA.ALQUILER"', '"GASTOS.CAFE"', '"Sin determinar"']);
  });

  it('trae la tabla de movimientos con su categoría', () => {
    expect(csv).toContain('categoria,categoria_ruta,categoria_confianza');
    expect(csv).toContain('"Gastos > Vivienda > Alquiler"');
  });

  it('no asciende un veredicto dudoso: esa fila va sin categoría', () => {
    // La de la TABLA, no la del bloque de principales movimientos: sólo la
    // primera empieza por el índice del movimiento.
    const fila = csv.split('\r\n').find((linea) => /^\d+,.*"RARO"/.test(linea)) ?? '';
    expect(fila.endsWith('"","",""')).toBe(true);
  });

  it('lleva la marca de orden de bytes, o Excel rompe las tildes', () => {
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  /*
   * Una glosa que empieza por `=` la escribió un banco, no el portal, y Excel la
   * ejecutaría como fórmula al abrir el archivo.
   */
  it('desactiva las fórmulas de una glosa hostil', () => {
    const hostil = statementToCsv(
      { transactions: [{ index: 1, description: '=1+1', movementType: 'DEBIT', amount: -1 }] },
      {},
    );
    expect(hostil).toContain('"\'=1+1"');
  });
});

describe('JSON con categorías', () => {
  const json = JSON.parse(statementToJson(result, veredictos));

  it('trae el resumen de los dos lados y el detalle ordenado por importe', () => {
    expect(json.resumen.ingresos.importe).toBe(7000);
    expect(json.resumen.gastos.importe).toBe(3025);
    expect(
      json.resumen.gastos.detalle.map((fila: { categoria: string }) => fila.categoria),
    ).toEqual(['GASTOS.VIVIENDA.ALQUILER', 'GASTOS.CAFE', null]);
  });

  it('cuenta como clasificados sólo los que lo están', () => {
    expect(json.resumen.movimientos).toBe(4);
    expect(json.resumen.clasificados).toBe(3);
  });

  it('cada movimiento lleva su categoría, y el dudoso no', () => {
    expect(json.movimientos[1].categoria).toBe('GASTOS.VIVIENDA.ALQUILER');
    expect(json.movimientos[1].confianza).toBe(0.91);
    expect(json.movimientos[3].categoria).toBeNull();
    expect(json.movimientos[3].ruta).toBeNull();
  });
});
