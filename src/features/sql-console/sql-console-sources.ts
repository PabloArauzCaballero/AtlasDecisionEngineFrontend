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

/** Las tres operaciones que la consola pide, por origen. */
type OperacionSql = 'catalog' | 'validate' | 'query';

/**
 * Cada ruta ENTERA, y no una raíz a la que se le pega el sufijo.
 *
 * Escrita como raíz + argumento —`${RUTAS[source]}${ruta}`— la ruta completa no
 * existe en ningún sitio del repositorio, y `scripts/engine-surface.mjs` sólo
 * sabe seguir la pista hasta el literal: `POST /v1/sql-console/query` y
 * `/validate` figuraban como superficie que ninguna pantalla llama, sobre una
 * consola que las usa en cada consulta. Una lista de deuda con entradas falsas
 * dentro deja de leerse, que es justo lo que ese gate existe para impedir.
 */
const RUTAS: Record<SqlSource, Record<OperacionSql, string>> = {
  MOTOR: {
    catalog: '/v1/sql-console/catalog',
    validate: '/v1/sql-console/validate',
    query: '/v1/sql-console/query',
  },
  ATLAS_BACKEND: {
    catalog: '/atlas-backend/sql-console/catalog',
    validate: '/atlas-backend/sql-console/validate',
    query: '/atlas-backend/sql-console/query',
  },
};

/**
 * AtlasBackend envuelve toda respuesta en `{ requestId, data, timestamp }`; el motor no.
 *
 * Se abre aquí para que el resto de la consola no tenga que saber de qué origen vino lo que está
 * pintando. La diferencia ya costó una pantalla en blanco en el cuaderno de datos.
 */
async function pedir<T>(
  source: SqlSource,
  operacion: OperacionSql,
  init?: Parameters<typeof apiRequest>[1],
): Promise<T> {
  const cuerpo = await apiRequest<unknown>(RUTAS[source][operacion], {
    ...init,
    /*
     * Un 401 del SEGUNDO origen no es la muerte de la sesión del portal.
     *
     * Sin esto, `authorizedFetch` lee cualquier 401 como «la sesión venció»: renueva el token,
     * reintenta, recibe el mismo 401 y llama a `expireSession()`. O sea que abrir la consola
     * echaba del portal a quien no tuviera permiso de consola en AtlasBackend — y en las pruebas
     * tumbaba las nueve, porque la sesión moría antes de que la pantalla llegara a pintarse.
     *
     * Es el mismo fallo que ya tuvo el generador documental y que este repositorio arregló
     * traduciendo su 401 a 502: un rechazo de OTRO servicio no puede tocar la sesión de éste.
     * Aquí se corta en el cliente, que es donde vive la reacción. Con la renovación desactivada,
     * el 401 vuelve como error normal y `fetchSqlCatalog` lo trata como «este origen no está
     * disponible», que es lo que de verdad significa.
     */
    retryOnUnauthorized: source === 'ATLAS_BACKEND' ? false : init?.retryOnUnauthorized,
  });
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
  return pedir<SqlCatalog>(source, 'catalog', { signal });
}

export function validarEn(
  source: SqlSource,
  statement: string,
  signal?: AbortSignal,
): Promise<QueryValidation> {
  return pedir<QueryValidation>(source, 'validate', {
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
  return pedir<QueryResult>(source, 'query', { method: 'POST', body: { statement }, signal });
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
    ...(motor?.datasets ?? []).map((dataset) => ({ ...dataset, origin: 'MOTOR' as const })),
    ...(backend?.datasets ?? []).map((dataset) => ({
      ...dataset,
      origin: 'ATLAS_BACKEND' as const,
    })),
  ];

  return {
    // Los techos del motor mandan cuando existe: es el origen por omisión, y anunciar unos límites
    // que no son los del destino haría que la consola prometiera lo que no puede cumplir.
    catalog: {
      datasets,
      /*
       * Las descartadas se unen igual que los datasets, y con el origen delante por lo mismo:
       * `riesgo.exposicion` y `v_pagos_v1` no se arreglan en el mismo repositorio.
       */
      omitted: [
        ...(motor?.omitted ?? []).map((entry) => ({
          ...entry,
          name: `Motor de decisión · ${entry.name}`,
        })),
        ...(backend?.omitted ?? []).map((entry) => ({
          ...entry,
          name: `AtlasBackend · ${entry.name}`,
        })),
      ],
      limits: motor?.limits ??
        backend?.limits ?? { maxRows: 0, timeoutMs: 0, maxStatementBytes: 0 },
    },
    index: indexarOrigenes(partes),
  };
}
