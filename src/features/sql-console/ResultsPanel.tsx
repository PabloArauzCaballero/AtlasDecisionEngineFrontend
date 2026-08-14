'use client';

import { AlertTriangle, Braces, Info, Table2 } from 'lucide-react';
import { useState } from 'react';
import { ResultsGrid } from './ResultsGrid';
import type { QueryResult, QueryViolation } from './sql-console.types';

interface Props {
  result: QueryResult | null;
  violations: QueryViolation[];
  error: string | null;
  running: boolean;
  maxRows: number;
}

type Panel = 'resultados' | 'json' | 'detalles';

const PANELS: { id: Panel; label: string; icon: typeof Table2 }[] = [
  { id: 'resultados', label: 'Resultados', icon: Table2 },
  { id: 'json', label: 'JSON', icon: Braces },
  { id: 'detalles', label: 'Detalles de ejecución', icon: Info },
];

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * El panel inferior, con las mismas tres caras que el de BigQuery.
 *
 * «Detalles de ejecución» no es relleno: es donde se ve que el planificador esperaba 300
 * filas y salieron 400.000. Esa diferencia es casi siempre la explicación de por qué una
 * consulta tardó, y sin enseñarla la única lectura posible es «la base va lenta».
 */
export function ResultsPanel({ result, violations, error, running, maxRows }: Props) {
  const [panel, setPanel] = useState<Panel>('resultados');

  if (running) {
    return (
      <div className="sql-results sql-results--busy" role="status">
        <span className="sql-results__spinner" aria-hidden />
        Ejecutando la consulta…
      </div>
    );
  }

  if (violations.length > 0) {
    return (
      <div className="sql-results sql-results--blocked" role="alert">
        <p className="sql-results__blocked-title">
          <AlertTriangle size={16} aria-hidden /> La consulta no se ejecutó
        </p>
        <ul className="sql-results__violations">
          {violations.map((violation, index) => (
            <li key={`${violation.code}-${index}`}>
              {violation.line ? (
                <span className="sql-results__at">línea {violation.line}</span>
              ) : null}
              {violation.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sql-results sql-results--blocked" role="alert">
        <p className="sql-results__blocked-title">
          <AlertTriangle size={16} aria-hidden /> {error}
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="sql-results sql-results--idle">
        <p>Escribe una consulta y pulsa «Ejecutar» (o Ctrl+Enter).</p>
      </div>
    );
  }

  return (
    <div className="sql-results">
      <div className="sql-results__bar">
        <div className="sql-results__tabs" role="tablist" aria-label="Vistas del resultado">
          {PANELS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`sql-panel-tab-${item.id}`}
              aria-selected={panel === item.id}
              aria-controls={`sql-panel-${item.id}`}
              className={`sql-results__tab${panel === item.id ? ' is-active' : ''}`}
              onClick={() => setPanel(item.id)}
            >
              <item.icon size={14} aria-hidden />
              {item.label}
            </button>
          ))}
        </div>
        <p className="sql-results__summary">
          <strong>{result.rowCount.toLocaleString('es')}</strong>{' '}
          {result.rowCount === 1 ? 'fila' : 'filas'} · {result.durationMs.toLocaleString('es')} ms
        </p>
      </div>

      {/*
       * El aviso de corte va ARRIBA y en ámbar, no al pie de la tabla.
       * Un resultado truncado sin aviso visible es la forma más silenciosa de sacar una
       * conclusión falsa: se cuentan 10.000 filas y se concluye sobre un universo que tenía
       * cuatro veces más.
       */}
      {result.truncated ? (
        <p className="sql-results__truncated" role="status">
          <AlertTriangle size={14} aria-hidden />
          Se muestran las primeras {maxRows.toLocaleString('es')} filas: el resultado completo es
          mayor. Agrega o acota antes de sacar conclusiones sobre el total.
        </p>
      ) : null}

      <div
        role="tabpanel"
        id={`sql-panel-${panel}`}
        aria-labelledby={`sql-panel-tab-${panel}`}
        className="sql-results__body"
      >
        {panel === 'resultados' ? <ResultsGrid result={result} /> : null}

        {panel === 'json' ? (
          <pre className="sql-results__json">
            {JSON.stringify(
              result.rows.map((row) =>
                Object.fromEntries(
                  row.map((value, index) => [result.columns[index]?.name ?? index, value]),
                ),
              ),
              null,
              2,
            )}
          </pre>
        ) : null}

        {panel === 'detalles' ? (
          <dl className="sql-results__details">
            <div>
              <dt>Filas devueltas</dt>
              <dd>{result.rowCount.toLocaleString('es')}</dd>
            </div>
            <div>
              <dt>Filas estimadas</dt>
              <dd>{result.estimate.estimatedRows.toLocaleString('es')}</dd>
            </div>
            <div>
              <dt>Volumen estimado</dt>
              <dd>{bytes(result.estimate.estimatedBytes)}</dd>
            </div>
            <div>
              <dt>Coste del plan</dt>
              <dd>{result.estimate.planCost.toLocaleString('es')}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>{result.durationMs.toLocaleString('es')} ms</dd>
            </div>
            <div className="sql-results__details-wide">
              <dt>Tablas recorridas</dt>
              <dd>
                {result.estimate.scannedRelations.length > 0
                  ? result.estimate.scannedRelations.join(' · ')
                  : '—'}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </div>
  );
}
