import { apiRequest } from '../../api/http-client';
import {
  ejecutarEn,
  fetchCatalogDe,
  resolverOrigen,
  unirCatalogos,
  validarEn,
  type SourceIndex,
} from './sql-console-sources';
import type {
  QueryHistoryPage,
  QueryResult,
  QueryValidation,
  SqlCatalog,
} from './sql-console.types';

/**
 * Las cuatro llamadas de la consola, ahora contra DOS bases.
 *
 * Todo pasa por `apiRequest`, que es la única puerta HTTP del portal: añade la sesión, rota el
 * token al recibir un 401 y normaliza los errores.
 *
 * La consulta viaja SIEMPRE en el cuerpo, incluso para validar. En la cadena de consulta acabaría
 * en el registro de acceso, en el proxy y en la traza —tres sitios pensados para conservarse— y una
 * consulta de análisis lleva dentro justo lo que se estaba buscando. Por eso `validarConsulta` es
 * un POST aunque no cambie nada: el verbo lo decide dónde puede viajar el dato, no si la operación
 * es idempotente.
 *
 * El segundo origen es AtlasBackend, que sirve la misma forma sobre su esquema `read_api`. El
 * destino de cada consulta se resuelve por la relación que nombra (`sql-console-sources.ts`), no
 * por un selector: quien escribe `FROM v_customer_overview_v1` está diciendo a qué base va, y
 * pedirle además que lo repita en un desplegable es una forma de que las dos cosas se contradigan.
 */

/** El índice de la última carga del catálogo. Lo usa el enrutado de cada consulta. */
let origenes: SourceIndex = new Map();

export async function fetchSqlCatalog(signal?: AbortSignal): Promise<SqlCatalog> {
  /*
   * Se piden los dos y se tolera que uno falle.
   *
   * Son servicios independientes: que el motor no conteste —o que AtlasBackend no esté
   * desplegado todavía— no puede dejar la consola vacía cuando la otra mitad sí responde. Con
   * `Promise.all` un 503 de cualquiera de los dos borraba el catálogo entero.
   */
  const [motor, backend] = await Promise.all([
    fetchCatalogDe('MOTOR', signal).catch(() => undefined),
    fetchCatalogDe('ATLAS_BACKEND', signal).catch(() => undefined),
  ]);

  const unido = unirCatalogos(motor, backend);
  origenes = unido.index;
  return unido.catalog;
}

/**
 * El «dry run»: planifica sin leer una fila.
 *
 * Responde 200 aunque la consulta sea inválida —el resultado de validar algo mal escrito es una
 * validación negativa, no un fallo de la petición— así que aquí no hay `catch`: un error de esta
 * llamada sí es un error de verdad y debe subir.
 */
export function validarConsulta(statement: string, signal?: AbortSignal): Promise<QueryValidation> {
  return validarEn(resolverOrigen(statement, origenes), statement, signal);
}

export function ejecutarConsulta(statement: string, signal?: AbortSignal): Promise<QueryResult> {
  return ejecutarEn(resolverOrigen(statement, origenes), statement, signal);
}

/**
 * El historial sigue siendo el del MOTOR.
 *
 * Es una sola lista y no la unión de dos: mezclarlas exigiría ordenar por fecha dos fuentes con
 * relojes distintos y sin identificador común, y el resultado leería como una secuencia que nunca
 * ocurrió. AtlasBackend guarda el suyo aparte, junto al del cuaderno de datos.
 */
export function fetchQueryHistory(limit = 25, signal?: AbortSignal): Promise<QueryHistoryPage> {
  return apiRequest<QueryHistoryPage>(`/v1/sql-console/history?limit=${limit}`, { signal });
}
