import { celdaCsv, partirLinea } from './category-csv';
import type { SemanticCategory } from './categories.api';
import type { UnresolvedItem } from './unresolved.api';

/**
 * El contrato de los pendientes: lo que hay que decidir y con qué se puede
 * decidir, en un solo texto que se pega en cualquier sitio.
 *
 * **Para qué existe.** Cuando quedan setenta glosas sin categoría, resolverlas
 * de una en una en la pantalla es media tarde. Con este texto se lleva el
 * problema entero a donde se pueda resolver en bloque —un modelo, una hoja, un
 * compañero— y se vuelve con las respuestas pegadas de golpe.
 *
 * **Lleva las categorías DISPONIBLES, no sólo las glosas.** Sin el catálogo,
 * cualquiera que lo lea inventará códigos que aquí no existen y el pegado de
 * vuelta fallará entero. Sólo van las hojas: una rama no clasifica nada.
 *
 * **Y lleva las instrucciones dentro.** Un JSON suelto no dice qué se espera de
 * vuelta; con el formato de respuesta escrito arriba, lo que llegue se puede
 * aplicar sin traducir nada a mano.
 */

export interface AsignacionPropuesta {
  readonly id: string;
  readonly categoryCode: string;
}

/** Lo que se copia al portapapeles. */
export function contratoDePendientes(
  pendientes: readonly UnresolvedItem[],
  categorias: readonly SemanticCategory[],
): string {
  const hojas = categorias
    .filter((categoria) => categoria.isActive && categoria.acceptanceThreshold < 1)
    .map((categoria) => ({
      code: categoria.code,
      name: categoria.name,
      description: categoria.description,
    }));

  const casos = pendientes.map((item) => ({
    id: item.id,
    // El texto que el motor lee de verdad, sin los identificadores. El original
    // va al lado por si el matiz que falta está justo en lo que se descartó.
    texto: textoDePendiente(item),
    textoOriginal: item.rawValue,
    apariciones: item.occurrenceCount,
    recomendacionDelMotor: item.suggestedCategoryCode,
    confianza: item.confidence,
    alternativas: item.alternatives ?? [],
  }));

  return [
    '# Clasificación de glosas bancarias pendientes',
    '',
    'Asigna a cada caso de `pendientes` una categoría de `categoriasDisponibles`.',
    'Usa EXCLUSIVAMENTE códigos de esa lista; si ninguno encaja, omite el caso.',
    'Responde SÓLO con un array JSON con esta forma, sin texto alrededor:',
    '[{ "id": "123", "categoryCode": "GASTOS.ALIMENTACION.SUPERMERCADO" }]',
    '',
    JSON.stringify({ categoriasDisponibles: hojas, pendientes: casos }, null, 2),
  ].join('\n');
}

/**
 * El texto que se enseña de un pendiente.
 *
 * Prefiere el que el clasificador leyó —ya sin `MCC 8299`, `CONTABILIZADA` ni
 * `TX-543462-F`— porque es el que explica el veredicto; el crudo se conserva
 * aparte y nunca se reescribe.
 */
export function textoDePendiente(item: UnresolvedItem): string {
  const contexto = item.context ?? {};
  const limpio = contexto.textoClasificado ?? contexto.normalizedText;
  return typeof limpio === 'string' && limpio.trim() !== '' ? limpio : item.rawValue;
}

/** Qué salió mal al leer una respuesta pegada. */
export class RespuestaInvalida extends Error {}

/**
 * Columnas del CSV de la bandeja, en este orden. Es contrato: lo que se descarga
 * se puede volver a subir sin tocar la cabecera.
 */
export const COLUMNAS_PENDIENTES = [
  'id',
  'texto',
  'apariciones',
  'recomendacion',
  'confianza',
  'categoryCode',
] as const;

/**
 * La bandeja como CSV, para decidirla en una hoja de cálculo y volver a subirla.
 *
 * **La última columna sale VACÍA a propósito.** Traerla rellenada con la
 * recomendación del motor convertiría «subir el archivo tal cual» en aceptar de
 * golpe todas sus conjeturas —justo las que no alcanzaron confianza suficiente,
 * que es por lo que están aquí—. Quien quiera la recomendación la tiene en su
 * columna, al lado, para copiarla cuando la haya mirado.
 */
export function pendientesACsv(pendientes: readonly UnresolvedItem[]): string {
  const filas = pendientes.map((item) =>
    [
      celdaCsv(item.id),
      celdaCsv(textoDePendiente(item)),
      celdaCsv(item.occurrenceCount),
      celdaCsv(item.suggestedCategoryCode),
      celdaCsv(item.confidence),
      '',
    ].join(','),
  );
  // La marca de orden de bytes, o Excel en Windows lee el archivo como ANSI y
  // toda glosa con tilde sale rota.
  return `\uFEFF${[COLUMNAS_PENDIENTES.join(','), ...filas].join('\r\n')}\r\n`;
}

/** Las filas de un JSON, sea el array pelado o el objeto que lo lleva dentro. */
function filasDeJson(texto: string): unknown[] {
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    throw new RespuestaInvalida('Eso no es JSON válido. Pega el array tal cual lo devolvió.');
  }

  if (Array.isArray(dato)) return dato;
  const envuelto = (dato as { asignaciones?: unknown }).asignaciones;
  if (Array.isArray(envuelto)) return envuelto;
  throw new RespuestaInvalida('Se esperaba un array de { id, categoryCode }.');
}

/**
 * Lee las asignaciones de un CSV.
 *
 * La cabecera se busca por NOMBRE y no por posición: una hoja de cálculo
 * reordena columnas sin avisar, y leer por posición asignaría la glosa como si
 * fuera un código de categoría.
 *
 * **Una fila sin `categoryCode` no es un error, es una que no se decidió.** De
 * setenta glosas se rellenan las que se saben; contarlas como fallos llenaría el
 * aviso de cuarenta líneas idénticas y escondería las que sí importan. Se dicen
 * en una sola línea, porque callarlas se leería como «se aplicaron todas».
 */
function filasDeCsv(texto: string): { filas: unknown[]; avisos: string[] } {
  const lineas = texto
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((linea) => linea.trim() !== '');
  const cabecera = partirLinea(lineas[0] ?? '').map((columna) => columna.toLowerCase());
  const columnaId = cabecera.indexOf('id');
  const columnaCodigo = cabecera.indexOf('categorycode');
  if (columnaId === -1 || columnaCodigo === -1) {
    throw new RespuestaInvalida(
      'Eso no es un array JSON ni un CSV con las columnas «id» y «categoryCode». ' +
        'Descarga la bandeja en CSV, rellena la columna «categoryCode» y vuelve a subirla.',
    );
  }

  const filas: unknown[] = [];
  let sinDecidir = 0;
  for (let n = 1; n < lineas.length; n += 1) {
    const celdas = partirLinea(lineas[n]);
    const id = celdas[columnaId] ?? '';
    const categoryCode = celdas[columnaCodigo] ?? '';
    if (id === '') continue;
    if (categoryCode === '') {
      sinDecidir += 1;
      continue;
    }
    filas.push({ id, categoryCode });
  }

  return {
    filas,
    avisos:
      sinDecidir > 0
        ? [`${String(sinDecidir)} fila(s) sin «categoryCode»: siguen pendientes.`]
        : [],
  };
}

/**
 * Lee la respuesta pegada —o el archivo subido— y la convierte en asignaciones
 * aplicables.
 *
 * **Dos formatos porque hay dos orígenes.** El JSON llega de un modelo: acepta
 * el array pelado y también un objeto que lo lleve dentro —devuelve una cosa u
 * otra según el día—, y tolera el bloque de código alrededor, que es como lo
 * copia media interfaz. El CSV llega de la hoja de cálculo donde alguien decidió
 * setenta glosas por columnas. Los dos acaban en la misma validación.
 *
 * **Valida contra lo que existe AQUÍ**: un identificador que no esté en la
 * bandeja o un código que no esté en el catálogo se rechaza con su motivo, en
 * lugar de mandar al motor una petición que va a fallar de todos modos. Un
 * error en una línea no invalida las demás: se aplican las buenas y se dice
 * cuántas se descartaron y por qué.
 */
export function leerAsignaciones(
  texto: string,
  pendientes: readonly UnresolvedItem[],
  codigosValidos: ReadonlySet<string>,
): { asignaciones: AsignacionPropuesta[]; descartadas: string[] } {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  if (limpio === '') throw new RespuestaInvalida('No hay nada que aplicar.');

  /*
   * El formato se decide por el primer carácter y no por la extensión, porque
   * aquí puede no haber archivo: quien pega un array lo pega con corchete, y una
   * hoja de cálculo empieza siempre por su cabecera.
   */
  const lectura =
    limpio.startsWith('[') || limpio.startsWith('{')
      ? { filas: filasDeJson(limpio), avisos: [] as string[] }
      : filasDeCsv(limpio);

  const conocidos = new Set(pendientes.map((item) => item.id));
  const asignaciones: AsignacionPropuesta[] = [];
  const descartadas: string[] = [...lectura.avisos];

  for (const fila of lectura.filas) {
    const registro = (fila ?? {}) as { id?: unknown; categoryCode?: unknown };
    const id = String(registro.id ?? '');
    const categoryCode = String(registro.categoryCode ?? '');
    if (id === '' || categoryCode === '') {
      descartadas.push('Una entrada sin «id» o sin «categoryCode».');
      continue;
    }
    if (!conocidos.has(id)) {
      descartadas.push(`${id}: ya no está pendiente.`);
      continue;
    }
    if (!codigosValidos.has(categoryCode)) {
      descartadas.push(`${id}: «${categoryCode}» no es una categoría del catálogo.`);
      continue;
    }
    asignaciones.push({ id, categoryCode });
  }

  return { asignaciones, descartadas };
}
