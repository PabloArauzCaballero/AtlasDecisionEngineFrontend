import type { Monaco } from '@monaco-editor/react';
import type { editor, languages, Position } from 'monaco-editor';
import type { CatalogDataset } from './sql-console.types';

/**
 * Autocompletado alimentado por el catálogo que sirve el motor.
 *
 * No es una comodidad: es lo que hace usable una superficie cuyos nombres nadie se sabe de
 * memoria. Sin esto, la única forma de averiguar que la columna se llama `ejecutada_en` y
 * no `fecha` es leer el explorador, escribirlo a mano y equivocarse una vez.
 *
 * La descripción de cada columna viaja al globo de la sugerencia, así que el significado
 * —«una fila = una decisión», «`bloquea` distingue el límite que RECHAZA del que sólo
 * mide»— se lee donde se está escribiendo y no en otra pantalla.
 *
 * Se registra un único proveedor y se re-registra cuando cambia el catálogo; el `dispose`
 * que devuelve `registerCompletionItemProvider` se guarda para no acumular proveedores en
 * cada render, que es como el autocompletado acaba ofreciendo cada tabla cinco veces.
 */

let registered: { dispose(): void } | null = null;

const KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'JOIN',
  'LEFT JOIN',
  'INNER JOIN',
  'ON',
  'AS',
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS NULL',
  'IS NOT NULL',
  'BETWEEN',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'WITH',
  'DISTINCT',
  'UNION ALL',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COALESCE',
  'NULLIF',
  'DATE_TRUNC',
  'NOW',
  'INTERVAL',
  'PERCENTILE_CONT',
  'FILTER',
  'OVER',
  'PARTITION BY',
];

export function registerSqlCompletions(monaco: Monaco, datasets: CatalogDataset[]): void {
  registered?.dispose();
  registered = monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' '],
    provideCompletionItems: (model: editor.ITextModel, position: Position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const Kind = monaco.languages.CompletionItemKind;
      const suggestions: languages.CompletionItem[] = [];

      for (const dataset of datasets) {
        suggestions.push({
          label: dataset.name,
          kind: Kind.Module,
          insertText: dataset.name,
          detail: 'dataset',
          documentation: dataset.description,
          range,
        });
        for (const table of dataset.tables) {
          suggestions.push({
            label: `${dataset.name}.${table.name}`,
            kind: Kind.Struct,
            insertText: `${dataset.name}.${table.name}`,
            detail: table.grain,
            documentation: table.description,
            // Las tablas se ordenan antes que las palabras clave: escribiendo `ejec` lo que
            // se busca casi siempre es la tabla, no `END`.
            sortText: `0${dataset.name}.${table.name}`,
            range,
          });
          for (const column of table.columns) {
            suggestions.push({
              label: column.name,
              kind: Kind.Field,
              insertText: column.name,
              detail: `${column.kind} · ${dataset.name}.${table.name}`,
              documentation: column.description,
              sortText: `1${column.name}`,
              range,
            });
          }
        }
      }

      for (const keyword of KEYWORDS) {
        suggestions.push({
          label: keyword,
          kind: Kind.Keyword,
          insertText: keyword,
          sortText: `2${keyword}`,
          range,
        });
      }

      return { suggestions };
    },
  });
}
