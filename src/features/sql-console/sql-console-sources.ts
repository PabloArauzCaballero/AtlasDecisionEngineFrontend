import { apiRequest } from '../../api/http-client';
import type { SqlCatalog, QueryResult, QueryValidation } from './sql-console.types';

/**
 * La consola consulta DOS bases, y hay que saber siempre cuál.
 *
 * El motor de decisión guarda lo que se decidió: ejecuciones, artefactos, desenlaces. AtlasBackend
 * guarda sobre QUIÉN se decidió: clientes, casos, consentimientos, bitácora. Son dos servicios con
 * dos bases y ninguna consulta puede cruzarlas — no comparten conexión, así que un `JOIN` entre una
 * tabla de cada lado no es que salga mal, es que no existe.
 *
 * Por eso el origen se resuelve por el dataset que la consulta nombra y se enseña en el explorador
 * agrupado: en una lista plana, `ejecuciones` y `v_customer_overview_v1` parecen dos tablas del
 * mismo sitio, y quien las una estará cruzando por identificadores que no significan lo mismo.
 */

export type SqlSource = 'MOTOR' | 'ATLAS_BACKEND';

const RUTAS: Record<SqlSource, string> = {
  MOTOR: '/v1/sql-console',
  ATLAS_BACKEND: '/atlas-backend/sql-console',
};

/**
 * AtlasBackend envuelve toda respuesta en `{ requestId, data, timestamp }`; el motor no.
 *
 * Se abre aquí para que el resto de la consola no tenga que saber de qué origen vino lo que está
 * pintando. La diferencia ya costó una pantalla en blanco en el cuaderno de datos.
 */
async function pedir<T>(
  source: SqlSource,
  ruta: string,
  init?: Parameters<typeof apiRequest>[1],
): Promise<T> {
  const cuerpo = await apiRequest<unknown>(`${RUTAS[source]}${ruta}`, init);
  if (source === 'ATLAS_BACKEND' && cuerpo && typeof cuerpo === 'object' && 'data' in cuerpo) {
    return (cuerpo as { data: T }).data;
  }
  return cuerpo as T;
}

/** Índice dataset -> origen, construido del catálogo unido. Es lo que enruta cada consulta. */
export type SourceIndex = Map<string, SqlSource>;

export function indexarOrigenes(
  catalogos: ReadonlyArray<{ source: SqlSource; catalog: SqlCatalog }>,
): SourceIndex {
  const indice: SourceIndex = new Map();
  for (const { source, catalog } of catalogos) {
    for (const dataset of catalog.datasets) {
      indice.set(dataset.name.toLowerCase(), source);
      // También por tabla: mucha gente escribe `FROM v_customer_overview_v1` sin calificar, y sin
      // esta entrada la consulta se iría al origen por omisión y fallaría con «no existe».
      for (const tabla of dataset.tables) indice.set(tabla.name.toLowerCase(), source);
    }
  }
  return indice;
}

/**
 * A qué base va esta consulta.
 *
 * Se decide por la PRIMERA relación conocida que nombra. Si no nombra ninguna —o nombra sólo
 * relaciones desconocidas— se manda al motor, que es donde iba antes de que existiera la segunda
 * fuente: una consola que cambia de destino por su cuenta sorprendería a quien ya la usaba.
 */
export function resolverOrigen(statement: string, indice: SourceIndex): SqlSource {
  const patron = /\b(?:from|join)\s+([a-z_][a-z0-9_]*)(?:\.([a-z_][a-z0-9_]*))?/gi;
  let coincidencia = patron.exec(statement);

  while (coincidencia) {
    const calificador = coincidencia[1].toLowerCase();
    const relacion = coincidencia[2]?.toLowerCase();
    const origen = indice.get(calificador) ?? (relacion ? indice.get(relacion) : undefined);
    if (origen) return origen;
    coincidencia = patron.exec(statement);
  }

  return 'MOTOR';
}

export function fetchCatalogDe(source: SqlSource, signal?: AbortSignal): Promise<SqlCatalog> {
  return pedir<SqlCatalog>(source, '/catalog', { signal });
}

export function validarEn(
  source: SqlSource,
  statement: string,
  signal?: AbortSignal,
): Promise<QueryValidation> {
  return pedir<QueryValidation>(source, '/validate', {
    method: 'POST',
    body: { statement },
    signal,
  });
}

export function ejecutarEn(
  source: SqlSource,
  statement: string,
  signal?: AbortSignal,
): Promise<QueryResult> {
  return pedir<QueryResult>(source, '/query', { method: 'POST', body: { statement }, signal });
}

/**
 * Une los dos catálogos y marca el origen en el nombre del dataset.
 *
 * El prefijo va en el nombre y no en un campo aparte porque el explorador que ya existe pinta
 * `dataset.name`: añadirlo aquí hace visible el origen sin tocar ese componente, y sin origen a la
 * vista las dos mitades se leen como una sola base.
 */
export function unirCatalogos(
  motor: SqlCatalog | undefined,
  backend: SqlCatalog | undefined,
): { catalog: SqlCatalog; index: SourceIndex } {
  const partes: Array<{ source: SqlSource; catalog: SqlCatalog }> = [];
  if (motor) partes.push({ source: 'MOTOR', catalog: motor });
  if (backend) partes.push({ source: 'ATLAS_BACKEND', catalog: backend });

  const datasets = [
    ...(motor?.datasets ?? []).map((dataset) => ({
      ...dataset,
      description: `Motor de decisión · ${dataset.description}`,
    })),
    ...(backend?.datasets ?? []).map((dataset) => ({
      ...dataset,
      description: `AtlasBackend · ${dataset.description}`,
    })),
  ];

  return {
    // Los techos del motor mandan cuando existe: es el origen por omisión, y anunciar unos límites
    // que no son los del destino haría que la consola prometiera lo que no puede cumplir.
    catalog: {
      datasets,
      limits: motor?.limits ??
        backend?.limits ?? { maxRows: 0, timeoutMs: 0, maxStatementBytes: 0 },
    },
    index: indexarOrigenes(partes),
  };
}
