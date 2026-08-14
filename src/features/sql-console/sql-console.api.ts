import { apiRequest } from '../../api/http-client';
import type {
  QueryHistoryPage,
  QueryResult,
  QueryValidation,
  SqlCatalog,
} from './sql-console.types';

/**
 * Las cuatro llamadas de la consola.
 *
 * Todo pasa por `apiRequest`, que es la única puerta HTTP del portal: añade la sesión,
 * rota el token al recibir un 401 y normaliza los errores.
 *
 * La consulta viaja SIEMPRE en el cuerpo, incluso para validar. En la cadena de consulta
 * acabaría en el registro de acceso, en el proxy y en la traza —tres sitios pensados para
 * conservarse— y una consulta de análisis lleva dentro justo lo que se estaba buscando.
 * Por eso `validarConsulta` es un POST aunque no cambie nada: el verbo lo decide dónde
 * puede viajar el dato, no si la operación es idempotente.
 */

export function fetchSqlCatalog(signal?: AbortSignal): Promise<SqlCatalog> {
  return apiRequest<SqlCatalog>('/v1/sql-console/catalog', { signal });
}

/**
 * El «dry run»: planifica sin leer una fila.
 *
 * Responde 200 aunque la consulta sea inválida —el resultado de validar algo mal escrito
 * es una validación negativa, no un fallo de la petición— así que aquí no hay `catch`: un
 * error de esta llamada sí es un error de verdad y debe subir.
 */
export function validarConsulta(statement: string, signal?: AbortSignal): Promise<QueryValidation> {
  return apiRequest<QueryValidation>('/v1/sql-console/validate', {
    method: 'POST',
    body: { statement },
    signal,
  });
}

export function ejecutarConsulta(statement: string, signal?: AbortSignal): Promise<QueryResult> {
  return apiRequest<QueryResult>('/v1/sql-console/query', {
    method: 'POST',
    body: { statement },
    signal,
  });
}

export function fetchQueryHistory(limit = 25, signal?: AbortSignal): Promise<QueryHistoryPage> {
  return apiRequest<QueryHistoryPage>(`/v1/sql-console/history?limit=${limit}`, { signal });
}
