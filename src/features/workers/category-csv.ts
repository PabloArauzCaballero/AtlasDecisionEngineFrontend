import type { SemanticCategory } from './categories.api';
import {
  problemasDeFormato,
  UMBRAL_HOJA,
  type CategoriaSubida,
  type ProblemaSubida,
} from './category-upload-errors';

/**
 * El árbol de categorías como CSV, en los dos sentidos, y el lector de JSON.
 *
 * **Por qué CSV además de JSON.** Un catálogo de doscientas categorías no se
 * escribe a mano en un editor: se arma en una hoja de cálculo, entre varias
 * personas, y se revisa por columnas. Obligar a convertirlo a JSON antes de
 * subirlo es exactamente el paso donde se cuelan comillas sin cerrar.
 *
 * **Las dos direcciones, o ninguna.** Un CSV de entrada sin uno de salida es un
 * formato que hay que adivinar; con la descarga, el catálogo actual ES la
 * plantilla: se baja, se edita en la hoja y se vuelve a subir. Por eso las
 * columnas de los dos lados son las mismas y en el mismo orden.
 *
 * **Los ejemplos se separan con `|`**, no con coma —que separa campos— ni con
 * punto y coma, que aparece dentro de las glosas bancarias.
 */

/** Columnas, en este orden. Es contrato: lo que se baja se puede volver a subir. */
export const COLUMNAS_CSV = [
  'code',
  'name',
  'description',
  'parentCode',
  'acceptanceThreshold',
  'positiveExamples',
  'counterExamples',
] as const;

/** Separador de los ejemplos dentro de su celda. */
export const SEPARADOR_EJEMPLOS = '|';

export interface Lectura {
  readonly categorias: CategoriaSubida[];
  readonly problemas: ProblemaSubida[];
}

/**
 * Divide una línea de CSV respetando las comillas.
 *
 * Se escribe aquí en vez de traer una biblioteca porque el formato a leer es el
 * que esta misma pantalla produce, y una descripción con comas —«Consultas,
 * tratamientos y urgencias»— es el caso normal, no el raro. Las comillas dobles
 * se escapan duplicándolas, como manda RFC 4180 y como escribe cualquier hoja.
 */
export function partirLinea(linea: string): string[] {
  const celdas: string[] = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (entreComillas) {
      if (caracter !== '"') {
        actual += caracter;
      } else if (linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = false;
      }
      continue;
    }
    if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === ',') {
      celdas.push(actual);
      actual = '';
    } else {
      actual += caracter;
    }
  }
  celdas.push(actual);
  return celdas.map((celda) => celda.trim());
}

function ejemplos(celda: string): string[] {
  return celda
    .split(SEPARADOR_EJEMPLOS)
    .map((ejemplo) => ejemplo.trim())
    .filter((ejemplo) => ejemplo !== '');
}

function numero(crudo: string): number {
  return crudo.trim() === '' ? UMBRAL_HOJA : Number(crudo.replace(',', '.'));
}

/**
 * Lee un CSV de categorías.
 *
 * La cabecera se busca por NOMBRE de columna, no por posición: una hoja de
 * cálculo reordena columnas con facilidad, y leer por posición convertiría ese
 * reordenamiento en categorías con la descripción metida en el nombre.
 *
 * Una fila mala no tira el archivo: se leen las buenas y se acumulan los
 * problemas de las otras con su número de línea.
 */
export function leerCsv(texto: string): Lectura {
  const lineas = texto
    // La marca de orden de bytes que escribe Excel: si no se quita, la primera
    // columna de la cabecera se llamaria BOM+«code» y no la encontraria nadie:
    // el archivo que esta misma pantalla descarga volveria rechazado.
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((linea) => linea.trim() !== '');
  if (lineas.length === 0)
    return { categorias: [], problemas: [problemasDeFormato.archivoVacio()] };

  const cabecera = partirLinea(lineas[0]).map((columna) => columna.toLowerCase());
  const indice = (columna: string) => cabecera.indexOf(columna.toLowerCase());
  if (indice('code') === -1 && indice('name') === -1) {
    return { categorias: [], problemas: [problemasDeFormato.csvSinCabecera()] };
  }
  const faltan = (['code', 'name'] as const).filter((columna) => indice(columna) === -1);
  if (faltan.length > 0) {
    return {
      categorias: [],
      problemas: [problemasDeFormato.csvColumnaFalta(faltan, COLUMNAS_CSV)],
    };
  }

  const categorias: CategoriaSubida[] = [];
  const problemas: ProblemaSubida[] = [];

  for (let n = 1; n < lineas.length; n += 1) {
    const celdas = partirLinea(lineas[n]);
    if (celdas.length !== cabecera.length) {
      problemas.push(
        problemasDeFormato.csvColumnasDescuadradas(n + 1, celdas.length, cabecera.length),
      );
      continue;
    }
    const lee = (columna: string): string => {
      const posicion = indice(columna);
      return posicion === -1 ? '' : (celdas[posicion] ?? '');
    };
    const padre = lee('parentCode');
    categorias.push({
      code: lee('code'),
      name: lee('name'),
      description: lee('description'),
      // Vacío es RAÍZ, no cadena vacía: el motor distingue «no cuelga de nadie»
      // de «cuelga de una categoría cuyo código es la cadena vacía».
      parentCode: padre === '' ? null : padre,
      acceptanceThreshold: numero(lee('acceptanceThreshold')),
      positiveExamples: ejemplos(lee('positiveExamples')),
      counterExamples: ejemplos(lee('counterExamples')),
    });
  }

  return { categorias, problemas };
}

function comoTexto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function comoLista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.map(comoTexto).filter((texto) => texto !== '') : [];
}

/** Lee el array de categorías de un JSON, con los mismos problemas catalogados. */
export function leerJson(texto: string): Lectura {
  if (texto.trim() === '')
    return { categorias: [], problemas: [problemasDeFormato.archivoVacio()] };

  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch (error) {
    return {
      categorias: [],
      problemas: [
        problemasDeFormato.jsonInvalido(
          error instanceof Error ? error.message : 'error de sintaxis',
        ),
      ],
    };
  }
  if (!Array.isArray(dato)) {
    return {
      categorias: [],
      problemas: [problemasDeFormato.jsonNoEsArray(dato === null ? 'null' : typeof dato)],
    };
  }

  const categorias: CategoriaSubida[] = [];
  const problemas: ProblemaSubida[] = [];

  dato.forEach((fila, indice) => {
    if (typeof fila !== 'object' || fila === null || Array.isArray(fila)) {
      problemas.push(problemasDeFormato.filaNoEsObjeto(`categoría ${String(indice + 1)}`));
      return;
    }
    const registro = fila as Record<string, unknown>;
    const padre = comoTexto(registro.parentCode);
    categorias.push({
      code: comoTexto(registro.code),
      name: comoTexto(registro.name),
      description: comoTexto(registro.description),
      parentCode: padre === '' ? null : padre,
      acceptanceThreshold:
        typeof registro.acceptanceThreshold === 'number'
          ? registro.acceptanceThreshold
          : numero(comoTexto(registro.acceptanceThreshold)),
      positiveExamples: comoLista(registro.positiveExamples),
      counterExamples: comoLista(registro.counterExamples),
    });
  });

  return { categorias, problemas };
}

/**
 * Una celda lista para un CSV: nulo es vacío, y el texto va entrecomillado con
 * las comillas duplicadas. Se exporta porque la bandeja de pendientes escribe su
 * propio CSV y las glosas bancarias llevan comas dentro; dos escapadores
 * distintos serían dos formas distintas de romper el mismo archivo.
 */
export function celdaCsv(valor: string | number | null): string {
  if (valor === null) return '';
  if (typeof valor === 'number') return String(valor);
  return `"${valor.split('"').join('""')}"`;
}

/**
 * El catálogo actual como CSV, listo para editar en una hoja y volver a subir.
 *
 * Lleva la marca de orden de bytes por lo de siempre: sin ella Excel en Windows
 * lee el archivo como ANSI y toda descripción con tilde sale rota.
 */
export function categoriasACsv(categorias: readonly SemanticCategory[]): string {
  const filas = categorias.map((categoria) =>
    [
      celdaCsv(categoria.code),
      celdaCsv(categoria.name),
      celdaCsv(categoria.description),
      celdaCsv(categoria.parentCode),
      celdaCsv(categoria.acceptanceThreshold),
      celdaCsv(categoria.positiveExamples.join(SEPARADOR_EJEMPLOS)),
      celdaCsv(categoria.counterExamples.join(SEPARADOR_EJEMPLOS)),
    ].join(','),
  );
  return `\uFEFF${[COLUMNAS_CSV.join(','), ...filas].join('\r\n')}\r\n`;
}
