import { asRecord, asRows, type UnknownRecord } from '../../utils/records';
import { resumirExtracto, type ResumenExtracto } from './statement-analytics';
import {
  resumirCategorias,
  type GrupoCategorias,
  type ResumenCategorias,
} from './statement-category-summary';
import { claveMovimiento, type VeredictoCategoria } from './useStatementCategories';

/**
 * Los movimientos del extracto CON su categoría, listos para descargar.
 *
 * **Por qué los arma el navegador.** El motor serializa el contrato normalizado
 * y no clasifica: la categoría de cada glosa la pide el portal al worker
 * semántico mientras se mira la tabla, y ese resultado nunca vuelve a la
 * ejecución del extracto. Pedirle al motor un CSV «con categorías» sería pedirle
 * un dato que de su lado no existe.
 *
 * **Los tres archivos del motor siguen siendo la fuente canónica** de lo que él
 * produjo; éstos son el atajo para quien quiere el reparto por categoría sin
 * cruzar dos archivos a mano.
 *
 * **El CSV abre con un resumen y después la tabla.** Es una concesión
 * deliberada: un CSV con dos secciones no lo lee un `read_csv` a secas, pero
 * este archivo se abre en una hoja de cálculo y lo primero que se busca es en
 * qué se fue el dinero. Quien necesite una tabla y nada más tiene los tres
 * archivos del motor y el JSON de aquí al lado, que sí es una sola estructura.
 */

/** Columnas de la tabla de movimientos, en este orden. */
const COLUMNAS = [
  'indice',
  'fecha',
  'descripcion',
  'tipo',
  'importe',
  'saldo',
  'categoria',
  'categoria_ruta',
  'categoria_confianza',
] as const;

interface Movimiento {
  readonly indice: number;
  readonly fecha: string;
  readonly descripcion: string;
  readonly tipo: string;
  readonly importe: number;
  readonly saldo: number | null;
  readonly categoria: string | null;
  readonly ruta: readonly string[];
  readonly confianza: number | null;
}

/**
 * Neutraliza la inyección de fórmulas en hojas de cálculo.
 *
 * Excel y sus equivalentes interpretan como fórmula toda celda que empiece por
 * `=`, `+`, `-` o `@`. Una glosa bancaria la escribió un tercero, así que puede
 * empezar por cualquiera de ellos, y al abrir el CSV se ejecutaría. El apóstrofo
 * inicial la fuerza a texto. Mismo criterio que `statement-download.ts` en el
 * motor: los dos archivos salen del mismo dato y corren el mismo riesgo.
 */
function celda(valor: string | number | null): string {
  if (valor === null || valor === undefined) return '""';
  // Los números van sin comillas: entrecomillados, algunas hojas los importan
  // como texto y entonces no se pueden sumar, que es para lo que se descargan.
  if (typeof valor === 'number') return String(valor);
  const texto = valor.split('\0').join('').trim();
  const seguro = /^[=+@-]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.split('"').join('""')}"`;
}

function fila(valores: ReadonlyArray<string | number | null>): string {
  return valores.map(celda).join(',');
}

/**
 * Los movimientos con su veredicto ya resuelto.
 *
 * Un veredicto dudoso —`AMBIGUOUS`, `UNKNOWN`— NO asciende a categoría, igual
 * que en la tabla y en el gráfico: quien reciba el archivo tiene que poder sumar
 * la columna sin heredar adivinanzas.
 */
export function movimientosConCategoria(
  result: unknown,
  veredictos: Record<string, VeredictoCategoria> | undefined,
): readonly Movimiento[] {
  return (asRows(asRecord(result).transactions) as UnknownRecord[]).map((row, posicion) => {
    const descripcion = String(row.description ?? '');
    const tipo = String(row.movementType ?? '');
    const veredicto = veredictos?.[claveMovimiento({ descripcion, movementType: tipo })];
    const decidido =
      veredicto?.fase === 'listo' && veredicto.categoria && veredicto.estado === 'MATCH'
        ? veredicto
        : undefined;

    return {
      indice: typeof row.index === 'number' ? row.index : posicion + 1,
      fecha: String(row.transactionDate ?? ''),
      descripcion,
      tipo,
      importe: typeof row.amount === 'number' ? row.amount : 0,
      saldo: typeof row.balance === 'number' ? row.balance : null,
      categoria: decidido?.categoria ?? null,
      ruta: decidido?.ruta ?? [],
      confianza: decidido?.confianza ?? null,
    };
  });
}

/** Las filas de resumen de un lado, ya ordenadas por importe. */
function filasDeGrupo(grupo: GrupoCategorias): string[] {
  return [
    fila([grupo.titulo, 'TOTAL', '', grupo.movimientos, redondear(grupo.importe)]),
    ...grupo.filas.map((entrada) =>
      fila([
        grupo.titulo,
        entrada.codigo ?? entrada.etiqueta,
        entrada.ruta.join(' > '),
        entrada.movimientos,
        redondear(entrada.importe),
      ]),
    ),
  ];
}

function redondear(valor: number): number {
  return Number(valor.toFixed(2));
}

/**
 * CSV con dos secciones: el reparto por categoría —ingresos y gastos, cada lado
 * ordenado de mayor a menor importe, que es lo que convierte la lista de gastos
 * en «los principales gastos»— y después la tabla de movimientos.
 */
export function statementToCsv(
  result: unknown,
  veredictos: Record<string, VeredictoCategoria> | undefined,
): string {
  const movimientos = movimientosConCategoria(result, veredictos);
  const resumen = resumirCategorias(result, veredictos);

  const cuentas = resumirExtracto(result);

  const lineas = [
    'RESUMEN DEL PERIODO',
    fila(['concepto', 'importe', 'movimientos']),
    fila(['Ingresos', cuentas.ingresos, cuentas.movimientosIngreso]),
    fila(['Gastos', cuentas.gastos, cuentas.movimientosGasto]),
    fila(['Neto', cuentas.neto, cuentas.movimientosIngreso + cuentas.movimientosGasto]),
    fila(['Saldo inicial', cuentas.saldoInicial, '']),
    fila(['Saldo final', cuentas.saldoFinal, '']),
    // El descuadre se escribe SIEMPRE que se pueda calcular, también cuando es
    // cero: leer «0,00» afirma que las dos cuentas cuadran; la ausencia de la
    // fila no afirma nada y se lee como que nadie lo comprobó.
    fila(['Descuadre contra saldos', cuentas.descuadre, '']),
    '',
    'PRINCIPALES MOVIMIENTOS',
    fila(['sentido', 'fecha', 'descripcion', 'importe']),
    ...cuentas.mayoresIngresos.map((movimiento) =>
      fila(['Ingreso', movimiento.fecha, movimiento.descripcion, movimiento.importe]),
    ),
    ...cuentas.mayoresGastos.map((movimiento) =>
      fila(['Gasto', movimiento.fecha, movimiento.descripcion, movimiento.importe]),
    ),
    '',
    'RESUMEN POR CATEGORIA',
    fila(['sentido', 'categoria', 'ruta', 'movimientos', 'importe']),
    ...filasDeGrupo(resumen.ingresos),
    ...filasDeGrupo(resumen.gastos),
    '',
    'MOVIMIENTOS',
    COLUMNAS.join(','),
    ...movimientos.map((movimiento) =>
      fila([
        movimiento.indice,
        movimiento.fecha,
        movimiento.descripcion,
        movimiento.tipo,
        movimiento.importe,
        movimiento.saldo,
        movimiento.categoria,
        movimiento.ruta.join(' > '),
        movimiento.confianza === null ? null : Number(movimiento.confianza.toFixed(4)),
      ]),
    ),
  ];

  /*
   * La marca de orden de bytes no es decoración: sin ella Excel en Windows lee
   * el archivo como ANSI y toda glosa con tilde sale rota, que es exactamente la
   * combinación a la que va destinado.
   */
  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}

/** Un lado del resumen, tal como se escribe en el JSON. */
function ladoJson(grupo: GrupoCategorias) {
  return {
    movimientos: grupo.movimientos,
    importe: redondear(grupo.importe),
    categorias: grupo.categorias,
    // Ordenadas por importe: en `gastos` esto ES la lista de principales gastos.
    detalle: grupo.filas.map((entrada) => ({
      categoria: entrada.codigo,
      etiqueta: entrada.etiqueta,
      ruta: entrada.ruta,
      movimientos: entrada.movimientos,
      importe: redondear(entrada.importe),
      agrupa: entrada.agrupa,
    })),
  };
}

/** El mismo contenido en una sola estructura, para quien lo consume por código. */
export function statementToJson(
  result: unknown,
  veredictos: Record<string, VeredictoCategoria> | undefined,
): string {
  const resumen = resumirCategorias(result, veredictos);
  const cuentas = resumirExtracto(result);
  return JSON.stringify(
    {
      periodo: {
        ingresos: cuentas.ingresos,
        gastos: cuentas.gastos,
        neto: cuentas.neto,
        movimientosIngreso: cuentas.movimientosIngreso,
        movimientosGasto: cuentas.movimientosGasto,
        saldoInicial: cuentas.saldoInicial,
        saldoFinal: cuentas.saldoFinal,
        descuadreContraSaldos: cuentas.descuadre,
        mayoresIngresos: cuentas.mayoresIngresos,
        mayoresGastos: cuentas.mayoresGastos,
      },
      resumen: {
        movimientos: resumen.totalMovimientos,
        clasificados: resumen.clasificados,
        categorias: resumen.categorias,
        ingresos: ladoJson(resumen.ingresos),
        gastos: ladoJson(resumen.gastos),
      },
      movimientos: movimientosConCategoria(result, veredictos).map((movimiento) => ({
        ...movimiento,
        ruta: movimiento.ruta.length > 0 ? movimiento.ruta : null,
      })),
    },
    null,
    2,
  );
}

export type { ResumenCategorias, ResumenExtracto };
