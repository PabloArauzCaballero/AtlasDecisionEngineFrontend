'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { JsonPanel } from '../components/JsonPanel';
import { StatusBadge } from '../components/StatusBadge';
import type { TestCase } from './testing.schemas';

interface TestCaseRowProps {
  testCase: TestCase;
  expanded: boolean;
  onToggle: () => void;
}

/** Etiquetas como fichas: una lista corta se lee; `["a","b"]` crudo, no. */
function tagList(value: unknown): string[] {
  const raw = typeof value === 'string' ? safeParse(value) : value;
  if (Array.isArray(raw)) return raw.map((tag) => String(tag));
  if (raw && typeof raw === 'object') return Object.keys(raw);
  return [];
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  const raw = typeof value === 'string' ? safeParse(value) : value;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : { valor: raw };
}

/**
 * Resumen de un payload en una celda.
 *
 * La versión anterior volcaba `JSON.stringify()` entero en la celda. Un payload
 * de ocho campos mide más de 200 caracteres, así que la tabla crecía hasta
 * sacar sus propias columnas de la pantalla y lo que se veía era medio objeto
 * cortado en seco por unos puntos suspensivos — ni el dato ni su forma.
 *
 * Aquí se dice cuántos campos hay y cuáles son los primeros: eso identifica el
 * caso de un vistazo. El contenido completo está a un clic, formateado.
 */
function summarize(value: unknown): { count: number; keys: string[] } {
  const record = asObject(value);
  const keys = Object.keys(record);
  return { count: keys.length, keys: keys.slice(0, 3) };
}

export function TestCaseRow({ testCase, expanded, onToggle }: TestCaseRowProps) {
  const input = summarize(testCase.inputJson);
  const expected = summarize(testCase.expectedResultJson);
  const tags = tagList(testCase.tagsJson);
  const detailId = `test-case-detail-${testCase.id}`;

  return (
    <>
      <tr className={expanded ? 'case-row is-open' : 'case-row'}>
        <td className="case-toggle-cell">
          <button
            type="button"
            className="case-toggle"
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={onToggle}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="mono">{testCase.caseCode}</span>
          </button>
        </td>
        <td className="case-name-cell">{testCase.testName}</td>
        <td>
          {tags.length ? (
            <span className="case-tags">
              {tags.map((tag) => (
                <em key={tag}>{tag}</em>
              ))}
            </span>
          ) : (
            <span className="faint-note">—</span>
          )}
        </td>
        <td className="case-summary-cell">
          <PayloadSummary summary={input} />
        </td>
        <td className="case-summary-cell">
          <PayloadSummary summary={expected} />
        </td>
        <td>
          <StatusBadge value={testCase.isActive ? 'ACTIVE' : 'INACTIVE'} />
        </td>
      </tr>
      {expanded ? (
        <tr className="case-detail-row" id={detailId}>
          <td colSpan={6}>
            <div className="case-detail">
              <JsonPanel value={testCase.inputJson} label="Entrada (payload)" />
              <JsonPanel value={testCase.expectedResultJson} label="Resultado esperado" />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function PayloadSummary({ summary }: { summary: { count: number; keys: string[] } }) {
  if (!summary.count) return <span className="faint-note">vacío</span>;
  return (
    <span className="case-summary">
      <strong>
        {summary.count} {summary.count === 1 ? 'campo' : 'campos'}
      </strong>
      <small className="mono">{summary.keys.join(', ')}</small>
    </span>
  );
}
