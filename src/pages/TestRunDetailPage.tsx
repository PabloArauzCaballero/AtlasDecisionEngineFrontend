import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Route, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { coveragePercentage, testRunSchema } from '../testing/testing.schemas';
import { downloadJson } from '../utils/download';

interface TestRunDetailPageProps {
  runId: string;
}

function describe(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function TestRunDetailPage({ runId }: TestRunDetailPageProps) {
  const query = useQuery({
    queryKey: ['test-run', runId],
    queryFn: ({ signal }) =>
      apiRequest(`/v1/test-runs/${encodeURIComponent(runId)}`, {
        signal,
        responseSchema: testRunSchema,
      }),
    enabled: Boolean(runId),
    refetchInterval: (current) =>
      current.state.data?.status === 'QUEUED' || current.state.data?.status === 'RUNNING'
        ? 1_000
        : false,
  });
  const run = query.data;
  const caseRuns = run?.caseRuns ?? [];
  const passed = caseRuns.filter((item) => item.resultStatus === 'PASS').length;
  const passRate = caseRuns.length ? Math.round((passed / caseRuns.length) * 100) : 0;
  const nodeCoverage = coveragePercentage(run?.coverage ?? [], 'NODE');
  const inProgress = run?.status === 'QUEUED' || run?.status === 'RUNNING';

  return (
    <>
      <PageHeader
        eyebrow="F3-06 · Test Run"
        title="Execution Result"
        description={`Run ${run?.id ?? runId} · ${run?.triggerType ?? '—'}`}
        actions={
          <div className="inline-actions">
            <Link className="button" href={`/test-runs/${encodeURIComponent(runId)}/coverage`}>
              <Route size={16} /> Ver cobertura
            </Link>
            <button
              className="button"
              type="button"
              disabled={!run}
              onClick={() => run && downloadJson(`test-run-${run.id}-evidence.json`, run)}
            >
              <ShieldCheck size={16} /> Descargar evidencia
            </button>
          </div>
        }
      />
      {query.isError ? <Alert tone="error">No fue posible cargar la ejecución.</Alert> : null}
      {inProgress ? (
        <Alert tone="info">
          La ejecución está {run?.status === 'QUEUED' ? 'en cola' : 'en progreso'}; esta vista se
          actualizará automáticamente.
        </Alert>
      ) : null}
      <div className="metric-grid">
        <MetricCard
          label="Pass Rate"
          value={`${passRate}%`}
          hint={`${passed}/${caseRuns.length} cases`}
          icon={CheckCircle2}
          tone="success"
        />
        <MetricCard
          label="Duration"
          value={String(run?.durationMs ?? 0)}
          hint="milliseconds"
          icon={Clock3}
        />
        <MetricCard
          label="Node Coverage"
          value={`${nodeCoverage.toFixed(1)}%`}
          hint="graph nodes"
          icon={Route}
        />
        <MetricCard
          label="Status"
          value={run?.status ?? 'LOADING'}
          hint="execution state"
          icon={ShieldCheck}
        />
      </div>
      <div className="result-layout">
        <Panel title="Assertions" meta={`${caseRuns.length} cases`}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Case</th>
                  <th>Description</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {caseRuns.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <StatusBadge value={item.resultStatus} />
                    </td>
                    <td className="mono">{item.testCase?.caseCode ?? item.testCaseId}</td>
                    <td>
                      {item.resultStatus === 'PASS'
                        ? (item.testCase?.testName ?? 'Assertions passed')
                        : describe(
                            item.errorJson ?? item.assertions.filter((entry) => !entry.passed),
                          )}
                    </td>
                    <td>{item.durationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Resumen de casos" meta="Trace">
          <Timeline
            items={caseRuns.slice(0, 8).map((item) => ({
              title: item.resultStatus,
              detail: item.testCase?.testName ?? item.testCaseId,
              meta: `${item.durationMs} ms`,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
