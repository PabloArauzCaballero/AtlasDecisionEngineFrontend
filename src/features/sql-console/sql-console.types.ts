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
  /** Qué es UNA fila. Se enseña junto a la tabla porque sin ella un `COUNT(*)` engaña. */
  grain: string;
  columns: CatalogColumn[];
}

export interface CatalogDataset {
  name: string;
  description: string;
  tables: CatalogTable[];
}

export interface ConsoleLimits {
  maxRows: number;
  timeoutMs: number;
  maxStatementBytes: number;
}

export interface SqlCatalog {
  datasets: CatalogDataset[];
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
