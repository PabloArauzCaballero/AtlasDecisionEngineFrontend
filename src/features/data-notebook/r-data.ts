/**
 * De la página cargada al `data.frame` de R: por COLUMNAS, y con un tipo por columna.
 *
 * Está separado del runtime porque es la parte que decide qué ve el análisis, y se puede comprobar
 * sin cargar 21 MB de intérprete. Lo que aquí se elija mal no rompe nada: produce números correctos
 * sobre datos que no son los que se sirvieron, que es el error caro de una herramienta de datos.
 *
 * ## Por qué el tipo se decide por COLUMNA y no por celda
 *
 * R es columnar y un `data.frame` exige un vector homogéneo por columna. Dejarle adivinar fila a
 * fila —lo que ocurre al armar el marco desde una lista de filas— tiene una consecuencia concreta:
 * una columna de importes con un solo `"N/D"` dentro sale ENTERA de texto, `mean()` falla o devuelve
 * `NA`, y nada en la pantalla dice por qué. Decidiéndolo aquí, la regla es explícita y comprobable.
 *
 * ## Por qué el valor ausente es `null` y nunca la cadena vacía
 *
 * `null` cruza a R como `NA`, que es ausencia: `mean(x, na.rm = TRUE)` la salta y `sum(is.na(x))` la
 * cuenta. La cadena vacía sería un valor, y convertiría «no lo sabemos» en «vale cero» o en una
 * categoría más del `table()`. Es la misma distinción que el portal defiende en los tableros de
 * medición, aplicada un nivel más abajo.
 */

/** Una columna tal como se enlaza a R: homogénea, con `null` donde falta el dato. */
export type ColumnaR = (number | null)[] | (boolean | null)[] | (string | null)[];

export type ColumnasR = Record<string, ColumnaR>;

function ausente(valor: unknown): boolean {
  return valor === null || valor === undefined;
}

/**
 * A texto, incluso lo que no es texto.
 *
 * Un objeto o una lista dentro de una celda —la carga JSON de un evento de auditoría— se serializa
 * en vez de convertirse en `[object Object]`, que es lo que haría `String()` y lo que dejaría una
 * columna entera indistinguible fila a fila.
 */
function aTexto(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean' || typeof valor === 'bigint') {
    return String(valor);
  }
  try {
    return JSON.stringify(valor) ?? String(valor);
  } catch {
    return String(valor);
  }
}

/**
 * El tipo de la columna: el más específico que admiten TODOS sus valores presentes.
 *
 * `NaN` e `Infinity` no cuentan como número a propósito: no sobreviven a un JSON y en R serían
 * `NaN`/`Inf`, que se propagan silenciosamente por cualquier agregación posterior.
 */
function tipoDe(valores: readonly unknown[]): 'numero' | 'booleano' | 'texto' {
  let hayNumero = false;
  let hayBooleano = false;

  for (const valor of valores) {
    if (ausente(valor)) continue;
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      hayNumero = true;
      continue;
    }
    if (typeof valor === 'boolean') {
      hayBooleano = true;
      continue;
    }
    return 'texto';
  }

  if (hayNumero && hayBooleano) return 'texto';
  if (hayNumero) return 'numero';
  if (hayBooleano) return 'booleano';
  // Sin un solo valor presente: texto. Un vector lógico de puros `NA` —que es lo que R hace con una
  // columna vacía— se une mal con datos de texto en cuanto alguien filtra o concatena.
  return 'texto';
}

/**
 * Las columnas de la página, listas para enlazar a R.
 *
 * Sin filas devuelve `{}` A PROPÓSITO: el preámbulo construye entonces un marco vacío pero con sus
 * columnas, a partir de la lista de nombres. Un objeto con vectores vacíos no lleva tipo, y R lo
 * convertiría en una lista de listas que `as.data.frame` no sabe apilar.
 */
export function columnasParaR(
  filas: readonly Record<string, unknown>[],
  columnas: readonly string[],
): ColumnasR {
  if (filas.length === 0) return {};

  const salida: ColumnasR = {};
  for (const columna of columnas) {
    const valores = filas.map((fila) => fila[columna]);
    const tipo = tipoDe(valores);

    if (tipo === 'numero') {
      salida[columna] = valores.map((valor) => (ausente(valor) ? null : Number(valor)));
      continue;
    }
    if (tipo === 'booleano') {
      salida[columna] = valores.map((valor) => (ausente(valor) ? null : Boolean(valor)));
      continue;
    }
    salida[columna] = valores.map((valor) => (ausente(valor) ? null : aTexto(valor)));
  }
  return salida;
}
