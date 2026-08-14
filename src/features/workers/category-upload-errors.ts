/**
 * Catálogo de lo que puede salir mal al subir categorías, y cómo se arregla.
 *
 * **Por qué un catálogo y no mensajes sueltos.** Una subida masiva falla lejos
 * de quien la escribió: el archivo lo armó otra persona, en una hoja de cálculo,
 * hace dos días. «Error al importar» obliga a esa persona a adivinar, y el ciclo
 * de adivinar-reintentar sobre doscientas filas es donde se pierde la tarde. Cada
 * problema de aquí dice tres cosas —DÓNDE está, QUÉ pasa y CÓMO se arregla— y
 * ninguna requiere abrir el código para entenderla.
 *
 * **Los mismos códigos para JSON y para CSV.** Las dos vías acaban en la misma
 * lista de categorías, así que fallan por lo mismo: un padre que no existe es un
 * padre que no existe, venga de una celda o de una llave. Sólo los problemas de
 * FORMATO son propios de cada vía, y llevan prefijo (`JSON_`, `CSV_`).
 *
 * **Se devuelven TODOS, no el primero.** Abortar en la fila 137 esconde que la
 * 138 también estaba mal y obliga a repetir el viaje entero.
 */

export type SeveridadProblema = 'error' | 'aviso';

export interface ProblemaSubida {
  readonly codigo: string;
  /** Dónde está: «línea 14», «categoría 3», o el código de la categoría. */
  readonly donde: string;
  readonly mensaje: string;
  /** Qué hacer para que deje de fallar. */
  readonly arreglo: string;
  readonly severidad: SeveridadProblema;
}

export interface CategoriaSubida {
  code: string;
  name: string;
  description: string;
  parentCode: string | null;
  acceptanceThreshold: number;
  positiveExamples: string[];
  counterExamples: string[];
}

/** Umbral por omisión de una hoja, el mismo que usa el catálogo sembrado. */
export const UMBRAL_HOJA = 0.62;
/** Umbral de una rama: inalcanzable a propósito, porque una rama no clasifica. */
export const UMBRAL_RAMA = 1;

/** Un código es de la forma `FAMILIA.RAMA.HOJA`: mayúsculas, dígitos y puntos. */
const CODIGO_VALIDO = /^[A-Z0-9_]+(?:\.[A-Z0-9_]+)*$/;

function problema(
  codigo: string,
  donde: string,
  mensaje: string,
  arreglo: string,
  severidad: SeveridadProblema = 'error',
): ProblemaSubida {
  return { codigo, donde, mensaje, arreglo, severidad };
}

/** Los problemas de formato, que dependen de la vía por la que llegó el archivo. */
export const problemasDeFormato = {
  archivoVacio: (): ProblemaSubida =>
    problema(
      'ARCHIVO_VACIO',
      'el archivo',
      'No hay nada que subir: el archivo está vacío.',
      'Comprueba que guardaste el archivo y que no subiste una carpeta o un acceso directo.',
    ),
  jsonInvalido: (detalle: string): ProblemaSubida =>
    problema(
      'JSON_INVALIDO',
      'el archivo',
      `No es JSON válido: ${detalle}`,
      'Suele ser una coma de más antes de un corchete o una comilla sin cerrar. Pega el texto en un validador de JSON para ver la posición exacta.',
    ),
  jsonNoEsArray: (tipo: string): ProblemaSubida =>
    problema(
      'JSON_NO_ES_ARRAY',
      'el archivo',
      `Se esperaba un array de categorías y llegó ${tipo}.`,
      'Envuelve las categorías en corchetes: [ { … }, { … } ]. Una sola categoría también va dentro de un array.',
    ),
  csvSinCabecera: (): ProblemaSubida =>
    problema(
      'CSV_SIN_CABECERA',
      'línea 1',
      'La primera línea debe ser la cabecera con los nombres de las columnas.',
      'Descarga el catálogo actual en CSV y usa ese archivo como plantilla: ya trae la cabecera correcta.',
    ),
  csvColumnaFalta: (columnas: readonly string[], esperadas: readonly string[]): ProblemaSubida =>
    problema(
      'CSV_COLUMNA_FALTA',
      'línea 1',
      `Falta la columna «${columnas.join('», «')}».`,
      `La cabecera debe incluir al menos «code» y «name». El juego completo es: ${esperadas.join(', ')}.`,
    ),
  csvColumnasDescuadradas: (linea: number, hay: number, esperadas: number): ProblemaSubida =>
    problema(
      'CSV_COLUMNAS_DESCUADRADAS',
      `línea ${String(linea)}`,
      `La fila tiene ${String(hay)} celdas y la cabecera declara ${String(esperadas)}.`,
      'Casi siempre es una coma dentro de un texto sin comillas. Entrecomilla la celda: "Consultas, tratamientos y urgencias".',
    ),
  filaNoEsObjeto: (donde: string): ProblemaSubida =>
    problema(
      'FILA_NO_ES_OBJETO',
      donde,
      'Esta entrada no es un objeto de categoría.',
      'Cada elemento del array debe ser un objeto con al menos «code» y «name».',
    ),
} as const;

/**
 * Revisa la lista ya leída y devuelve lo que impide subirla.
 *
 * `codigosExistentes` son los códigos que YA están en el catálogo: sin ellos, un
 * padre que vive en el catálogo pero no en el archivo se reportaría como
 * inexistente, que es justo el caso normal cuando alguien añade una rama nueva a
 * un árbol que ya existe.
 */
export function revisarCategorias(
  categorias: readonly CategoriaSubida[],
  codigosExistentes: ReadonlySet<string>,
): ProblemaSubida[] {
  const problemas: ProblemaSubida[] = [];
  const vistos = new Set<string>();
  const enElLote = new Set(categorias.map((categoria) => categoria.code));
  const conHijas = new Set(
    categorias.map((categoria) => categoria.parentCode).filter((padre) => padre !== null),
  );

  categorias.forEach((categoria, indice) => {
    const donde = categoria.code === '' ? `categoría ${String(indice + 1)}` : categoria.code;

    if (categoria.code === '') {
      problemas.push(
        problema(
          'CODIGO_FALTA',
          donde,
          'Falta el código de la categoría.',
          'El código es la identidad de la categoría y no puede quedar vacío. Ejemplo: GASTOS.MASCOTAS.VETERINARIA.',
        ),
      );
    } else if (!CODIGO_VALIDO.test(categoria.code)) {
      problemas.push(
        problema(
          'CODIGO_INVALIDO',
          donde,
          `«${categoria.code}» no tiene forma de código.`,
          'Sólo mayúsculas, dígitos, guion bajo y puntos para separar niveles: GASTOS.VIVIENDA.LUZ. Sin espacios ni acentos.',
        ),
      );
    } else if (vistos.has(categoria.code)) {
      problemas.push(
        problema(
          'CODIGO_DUPLICADO',
          donde,
          'Este código aparece dos veces en el mismo archivo.',
          'Deja una sola fila por código: si aparecen dos, no hay forma de saber cuál gana.',
        ),
      );
    }
    vistos.add(categoria.code);

    if (categoria.name.trim() === '') {
      problemas.push(
        problema(
          'NOMBRE_FALTA',
          donde,
          'Falta el nombre legible de la categoría.',
          'Es lo que se lee en la tabla y en los informes. Ejemplo: «Veterinaria».',
        ),
      );
    }

    if (
      !Number.isFinite(categoria.acceptanceThreshold) ||
      categoria.acceptanceThreshold < 0 ||
      categoria.acceptanceThreshold > 1
    ) {
      problemas.push(
        problema(
          'UMBRAL_INVALIDO',
          donde,
          `El umbral «${String(categoria.acceptanceThreshold)}» está fuera de rango.`,
          `Va entre 0 y 1. Una hoja suele ir en ${String(UMBRAL_HOJA)}; una rama en ${String(UMBRAL_RAMA)}, que la vuelve inalcanzable a propósito.`,
        ),
      );
    }

    if (categoria.parentCode !== null && categoria.parentCode !== '') {
      if (!enElLote.has(categoria.parentCode) && !codigosExistentes.has(categoria.parentCode)) {
        problemas.push(
          problema(
            'PADRE_INEXISTENTE',
            donde,
            `Su padre «${categoria.parentCode}» no existe ni en el archivo ni en el catálogo.`,
            'Incluye también la categoría padre en el archivo, o corrige el código si es un error de tecleo. El orden dentro del archivo no importa: el motor escribe de padre a hijo.',
          ),
        );
      }
      if (categoria.parentCode === categoria.code) {
        problemas.push(
          problema(
            'PADRE_CICLICO',
            donde,
            'La categoría se declara padre de sí misma.',
            'Deja «parentCode» vacío si es una raíz, o apunta a la categoría de la que cuelga.',
          ),
        );
      }
    }

    /*
     * Los dos avisos siguientes NO bloquean: son decisiones de catálogo que
     * alguien puede querer a propósito. Pero callarlos deja árboles que se
     * comportan al revés de lo que su forma sugiere, y eso sólo se descubre
     * clasificando.
     */
    const esRama = conHijas.has(categoria.code);
    if (esRama && categoria.acceptanceThreshold < 1) {
      problemas.push(
        problema(
          'RAMA_ALCANZABLE',
          donde,
          'Tiene hijas y además puede ganar por sí misma.',
          `Una rama agrupa; si compite con sus propias hojas, se lleva movimientos que pertenecían a una de ellas. Ponle umbral ${String(UMBRAL_RAMA)} salvo que quieras justo eso.`,
          'aviso',
        ),
      );
    }
    if (!esRama && categoria.acceptanceThreshold >= 1) {
      problemas.push(
        problema(
          'HOJA_INALCANZABLE',
          donde,
          'No tiene hijas y su umbral la hace inalcanzable.',
          `Con umbral ${String(UMBRAL_RAMA)} no clasificará nada nunca. Si es una hoja de verdad, bájalo a ${String(UMBRAL_HOJA)}.`,
          'aviso',
        ),
      );
    }
  });

  return problemas;
}

/** `true` si hay algo que impide subir; los avisos no cuentan. */
export function bloquean(problemas: readonly ProblemaSubida[]): boolean {
  return problemas.some((fallo) => fallo.severidad === 'error');
}
