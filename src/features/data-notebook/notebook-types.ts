/** Lo que una celda produce, en la forma en que la pantalla lo sabe dibujar. */

export type NotebookLanguage = 'python' | 'javascript';

/** Una tabla derivada: lo que devuelve un DataFrame o una lista de diccionarios. */
export interface DerivedTable {
  columns: string[];
  rows: Record<string, unknown>[];
}

export type CellOutcome =
  | {
      status: 'ok';
      /** El valor de la última expresión, ya normalizado. `undefined` si la celda no devolvió nada. */
      value: unknown;
      /** Tabla derivada, cuando el valor era un DataFrame, una Serie o una lista de registros. */
      table?: DerivedTable;
      logs: string[];
      durationMs: number;
    }
  | {
      status: 'error';
      error: string;
      logs: string[];
      durationMs: number;
    };

export interface NotebookCell {
  id: string;
  language: NotebookLanguage;
  source: string;
  outcome: CellOutcome | null;
  running: boolean;
  /** Número de ejecución, como en Colab: deja ver el ORDEN en que se corrió, no el orden en pantalla. */
  executionCount: number | null;
}

/** Estado del intérprete de Python, que se descarga la primera vez que se usa. */
export type PythonStatus =
  | { phase: 'idle' }
  | { phase: 'loading'; detail: string }
  | { phase: 'ready'; packages: string[] }
  | { phase: 'unavailable'; reason: string };
