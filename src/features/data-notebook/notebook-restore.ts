import type { CellOutcome, NotebookCellKind, NotebookLanguage } from './notebook-types';
import type { StoredCell, StoredOutcome } from './notebook-documents.api';

/**
 * De lo GUARDADO a lo que la pantalla sabe dibujar.
 *
 * Los dos lados tienen forma distinta a propósito. Lo que viaja por la API es plano —todos los
 * campos opcionales— porque así un cuaderno guardado hace meses sigue leyéndose aunque le falte
 * algo; lo que la vista usa es una unión discriminada por `status`, que es lo que impide escribir
 * `outcome.error` en la rama del éxito. Esta función es la costura entre ambos, y por eso está
 * sola en un archivo: si alguien añade un campo al contrato, aquí se ve que falta traerlo.
 *
 * Un resultado con `status` que no reconocemos se descarta —la celda aparece sin salida— en vez de
 * pintarse a medias: media tabla de un formato desconocido se lee como un dato, y no lo es.
 */
export function aCellOutcome(guardado: StoredOutcome | null | undefined): CellOutcome | null {
  if (!guardado) return null;

  if (guardado.status === 'ok') {
    return {
      status: 'ok',
      value: guardado.value,
      table: guardado.table
        ? {
            columns: guardado.table.columns,
            rows: guardado.table.rows as Record<string, unknown>[],
          }
        : undefined,
      images: guardado.images,
      logs: guardado.logs,
      durationMs: guardado.durationMs,
      savedAt: guardado.savedAt,
    };
  }

  if (guardado.status === 'error') {
    return {
      status: 'error',
      // El texto del error puede faltar en un documento viejo; la celda tiene que decir ALGO.
      error: guardado.error ?? 'La celda falló y el mensaje no se conservó.',
      logs: guardado.logs,
      durationMs: guardado.durationMs,
      savedAt: guardado.savedAt,
    };
  }

  return null;
}

/** Las celdas de un documento, listas para `replaceCells`. */
export function restaurarCeldas(guardadas: readonly StoredCell[]): Array<{
  kind: NotebookCellKind;
  language: NotebookLanguage;
  source: string;
  outcome: CellOutcome | null;
}> {
  return guardadas.map((celda) => ({
    kind: celda.kind,
    language: celda.language,
    source: celda.source,
    outcome: aCellOutcome(celda.outcome),
  }));
}
