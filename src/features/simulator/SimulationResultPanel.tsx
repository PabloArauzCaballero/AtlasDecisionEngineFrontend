'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { asRows, display } from '../../utils/records';
import { batchSummary, type BatchEntry } from './simulation-batch';

function formatValue(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

interface Props {
  entries: readonly BatchEntry[];
  index: number;
  onIndex: (index: number) => void;
  /**
   * Nombre legible de cada variable de salida, por su código.
   *
   * Opcional a propósito: si el contrato todavía no ha llegado —o el artefacto
   * no publica nombre para una salida— se enseña el código, que es lo que había
   * antes. Nunca se inventa un rótulo.
   */
  names?: Record<string, string>;
  children?: React.ReactNode;
}

/**
 * Resultado de la simulación, con un paginador cuando la tanda trae varios casos.
 *
 * El paginador no es adorno: al generar cinco casos sintéticos el motor devuelve
 * cinco decisiones distintas, y antes sólo se veía la última. Recorrerlas de una
 * en una es lo que permite comparar por qué una se aprueba y otra no.
 */
export function SimulationResultPanel({ entries, index, onIndex, names, children }: Props) {
  /** Rótulo publicado por el contrato, o el código si no publica ninguno. */
  const label = (code: string): string => names?.[code] ?? code;
  const active = entries[index];
  const result = active?.decision;
  const primaryResult = result?.primaryResult;
  const variableErrors = asRows(result?.errors);
  const total = entries.length;
  const summary = batchSummary(entries);

  return (
    <Panel
      title="Resultado de simulación"
      meta={result?.status ?? (active?.error ? 'ERROR' : 'WAITING')}
    >
      {total > 1 ? (
        <div className="simulation-pager">
          <button
            className="button"
            type="button"
            disabled={index <= 0}
            onClick={() => onIndex(index - 1)}
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          {/* `aria-live`: al pasar de caso sólo cambia el resultado, y sin esto
              quien usa lector de pantalla no se entera de que ya está en otro. */}
          <span className="simulation-pager-position" aria-live="polite">
            Caso {index + 1} de {total} · {active?.label}
          </span>
          <button
            className="button"
            type="button"
            disabled={index >= total - 1}
            onClick={() => onIndex(index + 1)}
          >
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
      {summary ? <small className="field-hint">La tanda dio: {summary}.</small> : null}

      <div className="simulation-result">
        {active?.error ? (
          <Alert tone="error">
            Este caso no llegó a decidirse: {active.error}. Los demás de la tanda sí se ejecutaron.
          </Alert>
        ) : null}
        <StatusBadge value={result?.outcome ?? 'WAITING'} />
        <strong>{formatValue(primaryResult?.value ?? result?.outcome)}</strong>
        {primaryResult ? (
          <small className="primary-result-label">
            Resultado principal · {label(primaryResult.code)}
          </small>
        ) : null}
        <dl className="dynamic-output-grid">
          {Object.entries(result?.output ?? {}).map(([key, value]) => (
            <div key={key}>
              {/*
               * Manda el nombre legible y el código baja al pie, igual que en el
               * formulario de entrada de al lado. La rejilla decía
               * `ingreso_verificado` y `decision_extracto` mientras el contrato
               * publicaba «Ingreso verificado» y «Decisión sobre el extracto»:
               * quien lee una decisión tenía que traducir cada rótulo de cabeza.
               * El código no se esconde —es la clave del contrato y la que se
               * usa al integrarse— pero deja de ser lo primero que se lee.
               */}
              <dt>{label(key)}</dt>
              <dd>{formatValue(value)}</dd>
              {label(key) === key ? null : <small className="output-code">{key}</small>}
            </div>
          ))}
        </dl>
        {result?.reasonCodes.map((reason) => (
          <article key={reason.code}>
            <span>{reason.code}</span>
            <p>{reason.message ?? reason.category ?? 'Sin mensaje público'}</p>
          </article>
        ))}
        {variableErrors.length ? (
          <Alert tone="warning">
            No se pudo decidir porque faltan o no son válidas estas variables de entrada:
            <ul className="simulator-error-list">
              {variableErrors.map((error, position) => (
                <li key={position}>
                  <b>{display(error, 'variableCode', 'code')}</b>{' '}
                  {display(error, 'message', 'errorCode')}
                </li>
              ))}
            </ul>
            Corrígelas en el formulario de la izquierda y vuelve a ejecutar.
          </Alert>
        ) : null}
        {children}
      </div>
    </Panel>
  );
}
