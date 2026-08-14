import { asRecord, asRows, type UnknownRecord } from '../../utils/records';
import { claveMovimiento, type VeredictoCategoria } from './useStatementCategories';

/**
 * Reparto de los movimientos del extracto entre las categorías detectadas,
 * **separado en lo que entra y lo que sale**.
 *
 * Un único ranking mezclado no responde a ninguna pregunta que alguien se haga
 * mirando un extracto. «Sueldo» y «Alquiler» compitiendo en la misma lista sólo
 * dicen cuál se repite más; lo que se viene a saber es de dónde viene el dinero
 * y en qué se va, y son dos preguntas distintas con dos respuestas distintas.
 *
 * El sentido lo decide el `movementType` que trae el banco, no el prefijo del
 * código de categoría: el banco es la fuente sobre si un movimiento sumó o
 * restó, y una categoría mal asignada no puede convertir un abono en un cargo.
 */

/** Cuántas categorías se dibujan por grupo antes de agrupar el resto. */
export const MAX_BARRAS = 8;

export interface CategoriaResumen {
  /** Código de la categoría, o `null` cuando el movimiento no tiene ninguna. */
  readonly codigo: string | null;
  /** Rótulo que se lee: la hoja de la ruta, o el código si no hay ruta. */
  readonly etiqueta: string;
  /** Ruta completa de la raíz a la hoja, para el detalle. */
  readonly ruta: readonly string[];
  readonly movimientos: number;
  /** Suma de los importes en valor absoluto: cuánto dinero pasó por aquí. */
  readonly importe: number;
  /** Cuántas categorías reales agrupa esta fila. 1 salvo en el resto agrupado. */
  readonly agrupa: number;
}

/** Un lado del extracto: lo que entró, o lo que salió. */
export interface GrupoCategorias {
  readonly sentido: 'ingresos' | 'gastos';
  readonly titulo: string;
  readonly filas: readonly CategoriaResumen[];
  readonly movimientos: number;
  /** Dinero del lado, en valor absoluto. */
  readonly importe: number;
  /** Categorías distintas del lado, incluidas las que no llegaron al gráfico. */
  readonly categorias: number;
  /** Barra mayor del lado, para escalar las longitudes. */
  readonly maximo: number;
}

export interface ResumenCategorias {
  readonly ingresos: GrupoCategorias;
  readonly gastos: GrupoCategorias;
  readonly totalMovimientos: number;
  readonly clasificados: number;
  /** Categorías distintas detectadas entre los dos lados. */
  readonly categorias: number;
}

type Mutable = {
  codigo: string | null;
  etiqueta: string;
  ruta: readonly string[];
  movimientos: number;
  importe: number;
  agrupa: number;
};

function nueva(codigo: string | null, etiqueta: string, ruta: readonly string[]): Mutable {
  return { codigo, etiqueta, ruta, movimientos: 0, importe: 0, agrupa: 1 };
}

/** Acumulador de un lado mientras se recorre el extracto. */
interface Lado {
  porCodigo: Map<string, Mutable>;
  sinDeterminar: Mutable;
}

function ladoVacio(): Lado {
  return { porCodigo: new Map(), sinDeterminar: nueva(null, 'Sin determinar', []) };
}

/**
 * Ordena por DINERO, no por número de movimientos.
 *
 * Ésta es la diferencia entre «los gastos más frecuentes» y «los principales
 * gastos», que es lo que hace falta: doce cafés de 20 Bs. no son el gasto
 * principal de un mes con un alquiler de 3.000. El recuento sigue escrito al
 * lado de cada barra, así que quien busque frecuencia también la tiene.
 */
function porImporte(a: Mutable, b: Mutable): number {
  return (
    b.importe - a.importe || b.movimientos - a.movimientos || a.etiqueta.localeCompare(b.etiqueta)
  );
}

function armarGrupo(lado: Lado, sentido: 'ingresos' | 'gastos', titulo: string): GrupoCategorias {
  const detectadas = [...lado.porCodigo.values()].sort(porImporte);
  const visibles: Mutable[] = detectadas.slice(0, MAX_BARRAS);
  const resto = detectadas.slice(MAX_BARRAS);

  /*
   * El resto se agrupa y se DICE cuánto agrupa. Cortar en las primeras sin más
   * dejaría un gráfico que parece completo y no lo es, que es la peor de las dos
   * opciones: mejor una barra que se nombra «otras N» que un tope callado.
   */
  if (resto.length > 0) {
    visibles.push({
      codigo: null,
      etiqueta: `Otras ${resto.length} categorías`,
      ruta: [],
      movimientos: resto.reduce((total, fila) => total + fila.movimientos, 0),
      importe: resto.reduce((total, fila) => total + fila.importe, 0),
      agrupa: resto.length,
    });
  }
  // «Sin determinar» SIEMPRE al final, por grande que sea: no es una categoría,
  // es su ausencia, y ordenarla con las demás la presentaría como el resultado
  // más frecuente del clasificador cuando es lo que el clasificador no supo decir.
  if (lado.sinDeterminar.movimientos > 0) visibles.push(lado.sinDeterminar);

  return {
    sentido,
    titulo,
    filas: visibles,
    movimientos: visibles.reduce((total, fila) => total + fila.movimientos, 0),
    importe: visibles.reduce((total, fila) => total + fila.importe, 0),
    categorias: detectadas.length,
    maximo: visibles.reduce((mayor, fila) => Math.max(mayor, fila.importe), 0),
  };
}

/** Agrupa los movimientos por su categoría, separando ingresos de gastos. */
export function resumirCategorias(
  result: unknown,
  veredictos: Record<string, VeredictoCategoria> | undefined,
): ResumenCategorias {
  const transactions = asRows(asRecord(result).transactions);
  const lados: Record<'ingresos' | 'gastos', Lado> = {
    ingresos: ladoVacio(),
    gastos: ladoVacio(),
  };
  let sinDeterminar = 0;

  for (const fila of transactions as UnknownRecord[]) {
    const descripcion = String(fila.description ?? '');
    const movementType = String(fila.movementType ?? '');
    const veredicto = veredictos?.[claveMovimiento({ descripcion, movementType })];
    const importe = Math.abs(typeof fila.amount === 'number' ? fila.amount : 0);
    const lado = lados[movementType === 'CREDIT' ? 'ingresos' : 'gastos'];

    // Un veredicto dudoso —`AMBIGUOUS`, `UNKNOWN`— no asciende a categoría: el
    // gráfico repite lo que dice la tabla, y allí tampoco se asciende.
    const decidido =
      veredicto?.fase === 'listo' && veredicto.categoria && veredicto.estado === 'MATCH'
        ? veredicto
        : undefined;

    if (!decidido?.categoria) {
      lado.sinDeterminar.movimientos += 1;
      lado.sinDeterminar.importe += importe;
      sinDeterminar += 1;
      continue;
    }

    const ruta = decidido.ruta ?? [];
    const acumulada =
      lado.porCodigo.get(decidido.categoria) ??
      nueva(decidido.categoria, ruta.at(-1) ?? decidido.categoria, ruta);
    acumulada.movimientos += 1;
    acumulada.importe += importe;
    lado.porCodigo.set(decidido.categoria, acumulada);
  }

  const ingresos = armarGrupo(lados.ingresos, 'ingresos', 'Ingresos');
  const gastos = armarGrupo(lados.gastos, 'gastos', 'Gastos');

  return {
    ingresos,
    gastos,
    totalMovimientos: transactions.length,
    clasificados: transactions.length - sinDeterminar,
    categorias: ingresos.categorias + gastos.categorias,
  };
}
