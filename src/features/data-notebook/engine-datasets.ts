import { ejecutarEn, fetchCatalogDe } from '../sql-console/sql-console-sources';
import type { OmittedRelation, SqlCatalog } from '../sql-console/sql-console.types';
import { sentenciasDePagina, TECHO_RECUENTO, type CatalogoMotor } from './engine-sql';
import type {
  NotebookColumn,
  NotebookDataset,
  NotebookPage,
  NotebookPageQuery,
} from './notebook.api';

/**
 * El segundo origen de datos del cuaderno: las vistas gobernadas del MOTOR.
 *
 * El cuaderno nació leyendo sólo `read_api` de AtlasBackend —clientes, casos, bitácora— y ésa es
 * la mitad de la casa. Lo que la gente viene a analizar aquí son las DECISIONES: qué se aprobó,
 * con qué puntaje, con qué desenlace. Eso vive en la base del motor, en cinco esquemas de vistas
 * gobernadas (`decisiones`, `riesgo`, `catalogo`, `desenlaces`, `auditoria`) que el portal ya lee
 * desde la consola SQL. Estaban a un salto y el cuaderno no las veía.
 *
 * No se abre un camino nuevo al motor: se reusan `/v1/sql-console/catalog` y `/query`, que ya
 * imponen sólo-lectura, acotan por inquilino dentro de la propia vista, revisan el plan antes de
 * ejecutar y dejan cada consulta —incluidas las rechazadas— en su bitácora. Un endpoint propio
 * para el cuaderno habría que volver a dotarlo de las cuatro cosas, y la que se olvidara no se
 * notaría hasta que importara.
 *
 * Se pide el origen `MOTOR` EXPLÍCITAMENTE (`fetchCatalogDe`, `ejecutarEn`) y no por las funciones
 * de alto nivel de la consola, por dos motivos que ya habrían roto esto:
 *
 *  - `fetchSqlCatalog()` devuelve el catálogo UNIDO de las dos bases, así que las vistas de
 *    `read_api` habrían aparecido dos veces: una por el endpoint del cuaderno, con su política de
 *    enmascarado, y otra por aquí, marcadas `PLAIN`. Dos caminos al mismo dato diciendo cosas
 *    distintas sobre si está tapado, y el permisivo ganando por ser el segundo.
 *  - `ejecutarConsulta()` resuelve el destino con un índice de módulo que sólo llena
 *    `fetchSqlCatalog()`. Desde el cuaderno ese índice está vacío y la consulta acabaría en el
 *    motor por el CAMINO POR OMISIÓN, no por una decisión: funcionaría hasta que alguien cambiara
 *    ese valor por omisión.
 */
const PREFIJO = 'motor:';

/** El identificador de la relación NUNCA sale de la entrada de nadie: viene del catálogo del motor. */
export function esDelMotor(code: string): boolean {
  return code.startsWith(PREFIJO);
}

function relacionDe(code: string): string {
  return code.slice(PREFIJO.length);
}

/**
 * Lo que el motor publica, recordado para poder COMPROBAR contra ello antes de consultar.
 *
 * Es la lista blanca de `engine-sql.ts`, y no una caché de rendimiento. La diferencia importa: el
 * `code` de un dataset llega también desde un cuaderno GUARDADO —`documento.datasetCode`, que su
 * dueño puede editar—, así que sin esta comprobación el nombre de la relación que se consulta
 * podría no haber salido nunca del catálogo del motor. Lo paraban su guardia léxica y su inspección
 * del plan; con esto, además, no llega a salir del navegador.
 *
 * Se llena en `fetchEngineDatasets` —que la pantalla ya pide— y, si alguien pide una página antes,
 * se pide el catálogo aquí mismo. Un fallo se olvida para poder reintentar; lo que NUNCA ocurre es
 * que un catálogo vacío se lea como «todo permitido»: sin relación conocida no se consulta nada.
 */
let conocidas: Promise<CatalogoMotor> | null = null;

function recordar(catalogo: SqlCatalog): CatalogoMotor {
  const mapa = new Map<string, ReadonlySet<string>>();
  for (const esquema of catalogo.datasets) {
    for (const tabla of esquema.tables) {
      mapa.set(
        `${esquema.name}.${tabla.name}`.toLowerCase(),
        new Set(tabla.columns.map((columna) => columna.name.toLowerCase())),
      );
    }
  }
  conocidas = Promise.resolve(mapa);
  return mapa;
}

function catalogoConocido(): Promise<CatalogoMotor> {
  if (!conocidas) {
    // Sin `signal` a propósito: la promesa la comparten varias llamadas y abortar una no puede
    // dejar a las demás sin lista blanca.
    conocidas = fetchCatalogDe('MOTOR').then(recordar);
    conocidas.catch(() => {
      conocidas = null;
    });
  }
  return conocidas;
}

/**
 * Las vistas del motor, tal y como el motor las descubre en su base.
 *
 * No hay ninguna lista aquí y ésa es la propiedad: el motor pregunta a `pg_catalog` qué vistas
 * gobernadas publica, así que una que alguien añada mañana llega hasta el cuaderno sin tocar este
 * repositorio ni el suyo. Lo único que este archivo decide es cómo se nombra un dataset del motor
 * para que no choque con los de AtlasBackend.
 */
export async function fetchEngineDatasets(
  signal?: AbortSignal,
): Promise<{ datasets: NotebookDataset[]; omitted: OmittedRelation[] }> {
  const catalogo = await fetchCatalogDe('MOTOR', signal);
  recordar(catalogo);
  return {
    datasets: catalogo.datasets.flatMap((esquema) =>
      esquema.tables.map((tabla) => ({
        code: `${PREFIJO}${esquema.name}.${tabla.name}`,
        view: `${esquema.name}.${tabla.name}`,
        label: tabla.name,
        /*
         * El grano se arrastra a propósito: sin él, un recuento sobre la tabla engaña —no es lo
         * mismo una fila por decisión que una fila por nodo recorrido— y es justo el error que un
         * cuaderno hace fácil cometer.
         *
         * Cuando el motor no lo declara —una vista que descubrió y que nadie ha fichado— no se
         * escribe la frase. Un «Una fila = null.» sería ruido, pero uno inventado del nombre sería
         * peor: se leería igual que un grano comprobado.
         */
        description: tabla.grain
          ? `${tabla.description} Una fila = ${tabla.grain}.`
          : tabla.description,
      })),
    ),
    omitted: catalogo.omitted ?? [],
  };
}

/**
 * Las columnas del motor viajan SIN política de enmascarado, y eso es una afirmación, no un hueco.
 *
 * El enmascarado del cuaderno es el de AtlasBackend sobre `read_api`. Lo que llega por aquí ya
 * viene gobernado por la vista del motor, así que el portal no tiene nada que tapar ni derecho a
 * decir que tapó algo. Marcarlas `MASKED` sería mentir en la dirección tranquilizadora.
 */
function columnaDe(name: string): NotebookColumn {
  return { name, dataType: null, piiType: null, policy: 'PLAIN', reason: null };
}

/**
 * Una página de una vista del motor.
 *
 * El SQL NO se compone aquí: lo compone `engine-sql.ts` contra el catálogo, y esta función se
 * limita a pedirlo y a darle forma de página del cuaderno. La separación es el punto — mezclar la
 * construcción del texto con la llamada de red es cómo una validación se queda a medias sin que
 * ninguna prueba lo note.
 */
export async function fetchEnginePage(
  code: string,
  query: NotebookPageQuery,
  signal?: AbortSignal,
): Promise<NotebookPage> {
  const relacion = relacionDe(code);
  const { pagina: consulta, recuento: conteo } = sentenciasDePagina(
    { relacion, ...query },
    await catalogoConocido(),
  );

  const [pagina, recuento] = await Promise.all([
    ejecutarEn('MOTOR', consulta, signal),
    ejecutarEn('MOTOR', conteo, signal),
  ]);

  const total = Number(recuento.rows[0]?.[0] ?? 0);

  return {
    dataset: { code, label: relacionDe(code), view: relacionDe(code) },
    columns: pagina.columns.map((columna) => columnaDe(columna.name)),
    /*
     * El motor manda las filas como MATRIZ para no perder dos columnas que se llamen igual. Aquí
     * se convierten a objetos porque es lo que pandas y el código de las celdas esperan, y se
     * puede: en un `SELECT *` sobre una vista los nombres son únicos —Postgres no admite una vista
     * con dos columnas del mismo nombre—, así que la conversión no pierde nada. Sobre una consulta
     * escrita a mano no valdría, y por eso esto no se generaliza.
     */
    rows: pagina.rows.map((fila) =>
      Object.fromEntries(pagina.columns.map((columna, indice) => [columna.name, fila[indice]])),
    ),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalIsExact: total < TECHO_RECUENTO,
    masked: false,
  };
}
