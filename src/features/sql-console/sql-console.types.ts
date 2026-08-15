/**
 * La forma de lo que sirve `/v1/sql-console`.
 *
 * El espejo del catálogo del motor (`dataset-catalog.ts`) no se copia aquí a mano: estos
 * tipos describen el SOBRE, y el contenido —qué datasets hay, qué columnas tiene cada
 * tabla— llega del motor en tiempo de ejecución. Duplicar el catálogo en el portal habría
 * hecho que publicar una tabla nueva exigiera desplegar las dos partes a la vez, y que
 * mientras tanto el explorador enseñara una superficie que ya no es la real.
 */

export type ColumnKind = 'texto' | 'numero' | 'entero' | 'booleano' | 'fecha' | 'identificador';

export interface CatalogColumn {
  name: string;
  kind: ColumnKind;
  description: string;
}

export interface CatalogTable {
  name: string;
  description: string;
  /**
   * Qué es UNA fila. Se enseña junto a la tabla porque sin ella un `COUNT(*)` engaña.
   *
   * `null` en una vista que la base publica y que nadie ha fichado todavía: desde que el motor
   * descubre su catálogo, puede haber tablas por delante de su documentación. Cuando falta se
   * calla —el motor no inventa un grano derivado del nombre, y la pantalla tampoco—.
   */
  grain: string | null;
  columns: CatalogColumn[];
}

export type CatalogOrigin = 'MOTOR' | 'ATLAS_BACKEND';

export interface CatalogDataset {
  /**
   * De que backend viene. Lo pone el portal al unir los catalogos, no el servidor.
   *
   * Sin el, el explorador ensena una lista plana donde `ejecuciones` y `credit.loans` parecen dos
   * tablas del mismo sitio — y no lo son: viven en bases distintas y ninguna consulta puede
   * cruzarlas. Agrupado por origen, esa imposibilidad se ve antes de escribir el JOIN.
   */
  origin?: CatalogOrigin;
  name: string;
  description: string;
  tables: CatalogTable[];
}

export interface ConsoleLimits {
  maxRows: number;
  timeoutMs: number;
  maxStatementBytes: number;
}

/**
 * Una relación que la base publica y el origen NO sirve, con el motivo.
 *
 * Existe porque un catálogo que encoge sin decirlo se lee como que la base tiene menos datos, y
 * manda a buscar el problema donde no está. Desde que los dos backends descubren su catálogo, la
 * pregunta «¿por qué no veo mi vista?» tiene respuesta: aparece aquí, con la línea que hay que
 * arreglar.
 */
export interface OmittedRelation {
  name: string;
  reason: string;
}

export interface SqlCatalog {
  datasets: CatalogDataset[];
  /** Opcional: un origen anterior al descubrimiento no lo manda, y eso no es un error. */
  omitted?: OmittedRelation[];
  limits: ConsoleLimits;
}

export interface QueryViolation {
  code: string;
  message: string;
  line?: number;
  column?: number;
}

export interface QueryEstimate {
  estimatedRows: number;
  estimatedBytes: number;
  planCost: number;
  scannedRelations: string[];
}

export interface QueryValidation {
  valid: boolean;
  violations: QueryViolation[];
  estimate?: QueryEstimate;
}

export type ResultColumnKind = 'texto' | 'numero' | 'entero' | 'booleano' | 'fecha' | 'json';

export interface ResultColumn {
  name: string;
  kind: ResultColumnKind;
}

export type ResultValue = string | number | boolean | null;

export interface QueryResult {
  columns: ResultColumn[];
  /**
   * Filas como MATRIZ, no como objetos.
   *
   * Es la forma en que el motor las manda y la razón está en su lado: una consulta puede
   * devolver dos columnas con el mismo nombre (`SELECT a.id, b.id …`) y un objeto sólo
   * conservaría la última. Convertirlas aquí a objetos para «trabajar más cómodo»
   * reintroduciría exactamente esa pérdida.
   */
  rows: ResultValue[][];
  rowCount: number;
  durationMs: number;
  truncated: boolean;
  estimate: QueryEstimate;
}

export type QueryOutcome = 'VALIDATED' | 'SUCCEEDED' | 'REJECTED' | 'FAILED';

export interface QueryHistoryEntry {
  id: string;
  statement: string;
  outcome: QueryOutcome;
  errorCode?: string | null;
  rowCount?: number | null;
  durationMs?: number | null;
  truncated: boolean;
  relations: string[];
  executedAt: string;
}

export interface QueryHistoryPage {
  entries: QueryHistoryEntry[];
}
