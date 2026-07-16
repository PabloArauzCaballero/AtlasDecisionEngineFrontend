import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { asRecord, asRows, display } from '../utils/records';

export function TestSuitesPage() {
  const params = useParams();
  const [draftId, setDraftId] = useState(params.versionId ?? '');
  const [versionId, setVersionId] = useState(params.versionId ?? '');
  const query = useQuery({
    queryKey: ['test-suites', versionId],
    queryFn: () =>
      apiRequest<unknown>(`/v1/artifact-versions/${versionId}/test-suites?page=1&pageSize=50`),
    enabled: Boolean(versionId),
  });
  const run = useMutation({
    mutationFn: (suiteId: string) =>
      apiRequest(`/v1/test-suites/${suiteId}/runs`, {
        method: 'POST',
        body: { triggerType: 'MANUAL_UI' },
      }),
  });
  const rows = asRows(asRecord(query.data).items);
  return (
    <>
      <PageHeader
        eyebrow="F3-01 · Quality"
        title={`Test Suites${versionId ? ` for v${versionId}` : ''}`}
        description="Suites deterministas, cobertura y gates bloqueantes por versión de artefacto."
        actions={
          <>
            <button
              className="button"
              type="button"
              disabled={!rows.length}
              onClick={() => rows.forEach((row) => run.mutate(display(row, 'id')))}
            >
              <Play size={16} /> Run All
            </button>
            <button className="button button-primary" type="button">
              <Plus size={16} /> Create Suite
            </button>
          </>
        }
      />
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setVersionId(draftId);
        }}
      >
        <label>
          <span>Artifact Version ID</span>
          <input value={draftId} onChange={(event) => setDraftId(event.target.value)} />
        </label>
        <button className="button button-primary" type="submit">
          Load suites
        </button>
      </form>
      {query.isError || run.isError ? (
        <Alert tone="error">{errorMessage(query.error ?? run.error)}</Alert>
      ) : null}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Bloqueante</th>
                <th>Casos Activos</th>
                <th>Último Resultado</th>
                <th>Cobertura</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const runs = asRows(row.runs);
                const latest = runs[0] ?? {};
                const coverage = Number(asRecord(latest.coverage).nodeCoveragePct ?? 0);
                return (
                  <tr key={display(row, 'id')}>
                    <td className="mono">{display(row, 'suiteCode')}</td>
                    <td>{display(row, 'name')}</td>
                    <td>{display(row, 'suiteType')}</td>
                    <td>
                      <StatusBadge value={row.isBlocking ? 'BLOCKING' : 'NON_BLOCKING'} />
                    </td>
                    <td>{asRows(row.cases).filter((item) => item.isActive !== false).length}</td>
                    <td>
                      <StatusBadge value={latest.status ?? 'NOT_RUN'} />
                    </td>
                    <td className="coverage-cell">
                      <ProgressBar value={coverage} />
                      <span>{coverage}%</span>
                    </td>
                    <td>
                      <div className="inline-actions">
                        <button type="button" onClick={() => run.mutate(display(row, 'id'))}>
                          <Play size={15} />
                        </button>
                        <Link to={`/test-suites/${display(row, 'id')}/cases`}>
                          <Eye size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
