import { useQueries } from '@tanstack/react-query';
import Link from 'next/link';
import { apiRequest } from '../../api/http-client';
import { StatusBadge } from '../../components/StatusBadge';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { caseRunRows } from './review-model';

/** La corrida más reciente de una suite: la que respalda (o no) la firma. */
function latestRun(suite: UnknownRecord): UnknownRecord | null {
  const runs = asRows(suite.runs);
  if (!runs.length) return null;
  return [...runs].sort((a, b) => Number(b.id) - Number(a.id))[0];
}

function coverageText(run: UnknownRecord): string {
  return asRows(run.coverage)
    .map((row) => {
      const tipo = row.coverageType === 'EDGE' ? 'caminos' : 'pasos';
      return `${display(row, 'coveredCount')}/${display(row, 'totalCount')} ${tipo}`;
    })
    .join(' · ');
}

/**
 * Las pruebas de la versión y lo que pasó en su última corrida, caso por caso.
 *
 * Por cada caso se enseña lo esperado, lo obtenido y el CAMINO que tomó por el grafo: es lo
 * que deja comprobar que la regla hace lo que dice por la razón que dice, y no sólo que el
 * resultado coincide por casualidad.
 */
export function TestEvidence({ suites, graph }: { suites: UnknownRecord[]; graph: unknown }) {
  const runs = suites.map(latestRun);
  const details = useQueries({
    queries: runs.map((run) => ({
      queryKey: ['test-run', run ? display(run, 'id') : null],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRequest<unknown>(`/v1/test-runs/${encodeURIComponent(display(run ?? {}, 'id'))}`, {
          signal,
        }),
      enabled: Boolean(run),
    })),
  });

  if (!suites.length) {
    return (
      <div className="empty-state">
        Esta versión no tiene pruebas. Nada respalda que decida lo que dice: no la firmes sin
        pedirlas.
      </div>
    );
  }

  return (
    <div className="analyst-suites">
      {suites.map((suite, index) => {
        const run = runs[index];
        const rows = caseRunRows(details[index]?.data, graph);
        return (
          <section key={display(suite, 'id')} className="analyst-suite">
            <div className="analyst-suite__head">
              <strong>{display(suite, 'name')}</strong>
              <span className="analyst-step__kind">
                {asRows(suite.cases).length} casos
                {suite.isBlocking ? ' · bloqueante' : ''}
              </span>
              {run ? (
                <>
                  <StatusBadge value={run.status} />
                  <span className="analyst-step__kind">{coverageText(run)}</span>
                  <Link href={`/test-runs/${display(run, 'id')}`}>
                    Corrida #{display(run, 'id')}
                  </Link>
                </>
              ) : (
                <StatusBadge value="SIN CORRIDAS" />
              )}
            </div>
            {rows.length ? (
              <div className="worker-table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Caso</th>
                      <th>Esperado</th>
                      <th>Obtenido</th>
                      <th>Camino que tomó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.code} data-passing={row.passed ? 'yes' : 'no'}>
                        <td>
                          <StatusBadge value={row.passed ? 'PASS' : 'FAIL'} /> {row.name}
                          <small className="analyst-case-code">{row.code}</small>
                        </td>
                        <td>{row.expected}</td>
                        <td>{row.error ?? row.actual}</td>
                        <td>{row.path.join(' → ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : run && details[index]?.isLoading ? (
              <p className="muted-text">Leyendo la corrida…</p>
            ) : (
              <ul className="analyst-step__why">
                {asRows(suite.cases).map((testCase) => (
                  <li key={display(testCase, 'id')}>
                    {display(testCase, 'testName')} — espera{' '}
                    {display(asRecord(testCase.expectedResultJson), 'outcome')}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
