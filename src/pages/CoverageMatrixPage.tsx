import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { asRecord, asRows, display } from '../utils/records';

export function CoverageMatrixPage() {
  const query = useQuery({
    queryKey: ['coverage-matrix'],
    queryFn: () => apiRequest<unknown>('/v1/traceability/coverage-matrix'),
  });
  const payload = asRecord(query.data);
  const rows = asRows(payload.objectives);
  const policies = asRows(payload.policies);
  const covered = Number(payload.covered ?? 0);
  const total = Number(payload.total ?? 0);
  const pct = total ? Math.round((covered / total) * 100) : 0;
  return (
    <>
      <PageHeader
        eyebrow="F7-07 · Business Traceability"
        title="Matriz de Cobertura"
        description="Estado de cumplimiento entre objetivos, políticas, artefactos y pruebas."
        actions={
          <>
            <button className="button" type="button">
              <Download size={16} /> Exportar
            </button>
            <button
              className="button button-primary"
              onClick={() => void query.refetch()}
              type="button"
            >
              <RefreshCw size={16} /> Sincronizar
            </button>
          </>
        }
      />
      {query.isError ? (
        <Alert tone="error">No fue posible construir la matriz de cobertura.</Alert>
      ) : null}
      <div className="metric-grid three">
        <MetricCard
          label="Coverage"
          value={`${pct}%`}
          hint="fully covered"
          icon={ShieldCheck}
          tone="success"
        />
        <MetricCard
          label="Evidence Links"
          value={`${covered} / ${total}`}
          hint="implemented controls"
          icon={RefreshCw}
        />
        <MetricCard
          label="Gaps"
          value={String(Math.max(0, total - covered))}
          hint="require attention"
          icon={TriangleAlert}
        />
      </div>
      <section className="panel coverage-matrix">
        <div className="panel-title">
          <span>Trazabilidad: Objetivos vs. Políticas</span>
          <small>Complete · Partial · Gap</small>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Objetivo de Negocio</th>
                {policies.map((policy) => (
                  <th key={display(policy, 'id')}>{display(policy, 'policyCode')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((objective) => {
                const links = asRecord(objective.coverage);
                return (
                  <tr key={display(objective, 'id')}>
                    <td>
                      <strong>{display(objective, 'objectiveCode')}</strong>
                      <small>{display(objective, 'name')}</small>
                    </td>
                    {policies.map((policy) => {
                      const state = String(links[display(policy, 'policyCode')] ?? 'GAP');
                      return (
                        <td key={display(policy, 'id')}>
                          <StatusBadge value={state} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="matrix-progress">
          <span>
            Overall coverage <b>{pct}%</b>
          </span>
          <ProgressBar value={pct} />
        </div>
      </section>
    </>
  );
}
