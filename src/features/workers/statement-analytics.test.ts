import { descuadreRelevante, resumirExtracto } from './statement-analytics';
import { statementToCsv, statementToJson } from './statement-export';

/**
 * Las cuentas del periodo: lo que se lee antes que nada.
 *
 * Un total mal sumado aquí no se nota —una cifra grande siempre parece
 * plausible— y viaja después al CSV, al JSON y a quien mida capacidad de pago
 * con ellos. Por eso se fija el aritmético, el sentido de cada movimiento y,
 * sobre todo, que el descuadre contra los saldos del banco se DIGA.
 */

const extracto = {
  balances: { opening: 100, closing: 1_100 },
  transactions: [
    { transactionDate: '2026-04-01', description: 'SUELDO', movementType: 'CREDIT', amount: 3000 },
    {
      transactionDate: '2026-04-02',
      description: 'ALQUILER',
      movementType: 'DEBIT',
      amount: -1500,
    },
    { transactionDate: '2026-04-03', description: 'LUZ', movementType: 'DEBIT', amount: -500 },
  ],
};

describe('resumen del periodo', () => {
  const resumen = resumirExtracto(extracto);

  it('suma cada lado por su sentido, no por el signo del importe', () => {
    expect(resumen.ingresos).toBe(3000);
    expect(resumen.gastos).toBe(2000);
    expect(resumen.neto).toBe(1000);
    expect(resumen.movimientosIngreso).toBe(1);
    expect(resumen.movimientosGasto).toBe(2);
  });

  /*
   * Hay plantillas que imprimen los cargos en positivo, en su propia columna.
   * Fiarse del signo convertía esos gastos en ingresos.
   */
  it('un cargo impreso en positivo sigue siendo un gasto', () => {
    const raro = resumirExtracto({
      transactions: [{ description: 'COMISION', movementType: 'DEBIT', amount: 50 }],
    });
    expect(raro.gastos).toBe(50);
    expect(raro.ingresos).toBe(0);
  });

  it('cuando saldos y movimientos cuadran, no hay descuadre que avisar', () => {
    expect(resumen.descuadre).toBe(0);
    expect(descuadreRelevante(resumen)).toBe(false);
  });

  /*
   * Que la variación de saldos no cuadre con los movimientos significa que al
   * extracto le faltan filas. Callarlo dejaría unos totales que parecen
   * completos y no lo son.
   */
  it('avisa cuando los saldos del banco no cuadran con lo leído', () => {
    const incompleto = resumirExtracto({
      balances: { opening: 100, closing: 5_000 },
      transactions: extracto.transactions,
    });
    expect(incompleto.descuadre).toBe(3900);
    expect(descuadreRelevante(incompleto)).toBe(true);
  });

  it('sin saldos publicados no inventa un descuadre', () => {
    const sinSaldos = resumirExtracto({ transactions: extracto.transactions });
    expect(sinSaldos.descuadre).toBeNull();
    expect(descuadreRelevante(sinSaldos)).toBe(false);
  });

  it('destaca los mayores de cada lado, de mayor a menor', () => {
    expect(resumen.mayoresGastos.map((fila) => fila.descripcion)).toEqual(['ALQUILER', 'LUZ']);
    expect(resumen.mayoresIngresos.map((fila) => fila.descripcion)).toEqual(['SUELDO']);
  });
});

describe('el resumen del periodo también viaja en los archivos', () => {
  it('el CSV abre con las cuentas y los principales movimientos', () => {
    const csv = statementToCsv(extracto, {});
    expect(csv).toContain('RESUMEN DEL PERIODO');
    expect(csv).toContain('"Ingresos",3000,1');
    expect(csv).toContain('"Gastos",2000,2');
    expect(csv).toContain('"Neto",1000,3');
    expect(csv).toContain('PRINCIPALES MOVIMIENTOS');
    expect(csv).toContain('"Gasto","2026-04-02","ALQUILER",1500');
  });

  it('el JSON trae las mismas cifras y los saldos del banco', () => {
    const json = JSON.parse(statementToJson(extracto, {}));
    expect(json.periodo.ingresos).toBe(3000);
    expect(json.periodo.gastos).toBe(2000);
    expect(json.periodo.neto).toBe(1000);
    expect(json.periodo.saldoInicial).toBe(100);
    expect(json.periodo.saldoFinal).toBe(1100);
    expect(json.periodo.descuadreContraSaldos).toBe(0);
    expect(json.periodo.mayoresGastos[0].descripcion).toBe('ALQUILER');
  });
});
