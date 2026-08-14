'use client';

import { CheckCircle2, CircleSlash, Clock, XCircle } from 'lucide-react';
import type { QueryHistoryEntry, QueryOutcome } from './sql-console.types';

interface Props {
  entries: QueryHistoryEntry[];
  loading: boolean;
  onReuse: (statement: string) => void;
}

/**
 * El historial personal.
 *
 * Muestra los CUATRO desenlaces, no sólo los que salieron bien. Un historial que esconde
 * los rechazos deja a quien consulta sin la mitad de lo que necesita para aprender la
 * superficie —«esto no se puede, esto sí»— y convierte el aprendizaje en prueba y error sin
 * memoria. Es además la misma lista que ve un auditor del otro lado, así que enseñarla
 * completa evita la sorpresa de descubrir que quedaba registro de los intentos fallidos.
 *
 * Cada quien ve lo suyo: el motor filtra por el sujeto de la sesión y no hay forma de pedir
 * el historial de otra persona.
 */
const ICONO: Record<QueryOutcome, typeof CheckCircle2> = {
  SUCCEEDED: CheckCircle2,
  VALIDATED: Clock,
  REJECTED: CircleSlash,
  FAILED: XCircle,
};

const ETIQUETA: Record<QueryOutcome, string> = {
  SUCCEEDED: 'Completada',
  VALIDATED: 'Sólo validada',
  REJECTED: 'Rechazada',
  FAILED: 'Falló',
};

export function QueryHistoryPanel({ entries, loading, onReuse }: Props) {
  if (loading) return <p className="sql-history__empty">Cargando el historial…</p>;
  if (entries.length === 0) {
    return <p className="sql-history__empty">Todavía no has ejecutado ninguna consulta.</p>;
  }

  return (
    <ul className="sql-history">
      {entries.map((entry) => {
        const Icon = ICONO[entry.outcome] ?? Clock;
        return (
          <li key={entry.id} className={`sql-history__item is-${entry.outcome.toLowerCase()}`}>
            <button
              type="button"
              className="sql-history__reuse"
              onClick={() => onReuse(entry.statement)}
              aria-label={`Reabrir en una consulta: ${entry.statement.slice(0, 80)}`}
            >
              <span className="sql-history__head">
                <Icon size={13} aria-hidden />
                <span className="sql-history__outcome">
                  {ETIQUETA[entry.outcome] ?? entry.outcome}
                </span>
                <time dateTime={entry.executedAt}>
                  {new Date(entry.executedAt).toLocaleString('es')}
                </time>
              </span>
              <code className="sql-history__sql">{entry.statement}</code>
              <span className="sql-history__meta">
                {entry.rowCount !== null && entry.rowCount !== undefined
                  ? `${entry.rowCount.toLocaleString('es')} filas`
                  : null}
                {entry.durationMs ? ` · ${entry.durationMs} ms` : null}
                {entry.truncated ? ' · resultado cortado' : null}
                {entry.errorCode ? ` · ${entry.errorCode}` : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
