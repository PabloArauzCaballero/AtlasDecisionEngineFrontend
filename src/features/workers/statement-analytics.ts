import { asRecord, asRows, type UnknownRecord } from '../../utils/records';

/**
 * Las cuentas del extracto: lo que entró, lo que salió y qué quedó.
 *
 * **Por qué no basta con el gráfico de categorías.** Ese responde «en qué se
 * reparte», y sólo sobre lo que se pudo clasificar. Antes de eso hay una
 * pregunta más simple y más importante —cuánto entró, cuánto salió, si el mes
 * cerró en positivo— que se contesta con los movimientos enteros, clasificados o
 * no. Mezclarlas dejaba la primera sin respuesta: dos totales sueltos en las
 * cabeceras de un gráfico no son un estado de cuenta.
 *
 * **Los saldos del banco van al lado, y no se suman a nada.** Saldo inicial y
 * final los imprime el documento; ingresos y gastos salen de sumar movimientos.
 * Que la diferencia entre saldos no cuadre con el neto es un dato —significa que
 * al extracto le faltan movimientos, o que el banco arrastra algo que no
 * imprime—, así que se enseña el descuadre en vez de esconderlo.
 */

export interface MovimientoDestacado {
  readonly fecha: string;
  readonly descripcion: string;
  readonly importe: number;
  readonly esIngreso: boolean;
}

export interface ResumenExtracto {
  readonly ingresos: number;
  readonly gastos: number;
  /** Ingresos menos gastos: lo que el periodo dejó. */
  readonly neto: number;
  readonly movimientosIngreso: number;
  readonly movimientosGasto: number;
  readonly saldoInicial: number | null;
  readonly saldoFinal: number | null;
  /**
   * Diferencia entre lo que dicen los saldos y lo que suman los movimientos.
   * `null` cuando el documento no publica los dos saldos y no hay nada que
   * contrastar.
   */
  readonly descuadre: number | null;
  /** Los mayores del periodo, de cada lado, por importe. */
  readonly mayoresIngresos: readonly MovimientoDestacado[];
  readonly mayoresGastos: readonly MovimientoDestacado[];
}

/** Cuántos movimientos se destacan por lado. */
export const MAX_DESTACADOS = 5;

/** Tolerancia del descuadre: por debajo de un centavo es redondeo, no un hueco. */
const CENTAVO = 0.01;

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

export function resumirExtracto(result: unknown): ResumenExtracto {
  const data = asRecord(result);
  const balances = asRecord(data.balances);
  const transactions = asRows(data.transactions) as UnknownRecord[];

  const destacados: MovimientoDestacado[] = [];
  let ingresos = 0;
  let gastos = 0;
  let movimientosIngreso = 0;
  let movimientosGasto = 0;

  for (const fila of transactions) {
    const importe = Math.abs(numero(fila.amount) ?? 0);
    /*
     * El sentido lo decide `movementType`, que es lo que el banco declaró, y no
     * el signo del importe: hay plantillas que imprimen los cargos en positivo
     * en su propia columna, y ahí el signo no dice nada.
     */
    const esIngreso = String(fila.movementType ?? '') === 'CREDIT';
    if (esIngreso) {
      ingresos += importe;
      movimientosIngreso += 1;
    } else {
      gastos += importe;
      movimientosGasto += 1;
    }
    destacados.push({
      fecha: String(fila.transactionDate ?? ''),
      descripcion: String(fila.description ?? ''),
      importe,
      esIngreso,
    });
  }

  const saldoInicial = numero(balances.opening);
  const saldoFinal = numero(balances.closing);
  const neto = redondear(ingresos - gastos);
  const variacion = saldoInicial === null || saldoFinal === null ? null : saldoFinal - saldoInicial;
  const descuadre = variacion === null ? null : redondear(variacion - neto);

  const mayores = (lado: boolean) =>
    destacados
      .filter((movimiento) => movimiento.esIngreso === lado)
      .sort((a, b) => b.importe - a.importe)
      .slice(0, MAX_DESTACADOS);

  return {
    ingresos: redondear(ingresos),
    gastos: redondear(gastos),
    neto,
    movimientosIngreso,
    movimientosGasto,
    saldoInicial,
    saldoFinal,
    descuadre: descuadre === null || Math.abs(descuadre) < CENTAVO ? descuadre : descuadre,
    mayoresIngresos: mayores(true),
    mayoresGastos: mayores(false),
  };
}

/** `true` cuando el descuadre es real y no un resto de redondeo. */
export function descuadreRelevante(resumen: ResumenExtracto): boolean {
  return resumen.descuadre !== null && Math.abs(resumen.descuadre) >= CENTAVO;
}

function redondear(valor: number): number {
  return Number(valor.toFixed(2));
}
