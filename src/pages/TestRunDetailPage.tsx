import { CheckCircle2, Clock3, Route, ShieldCheck } from 'lucide-react';
import { Alert } from '../components/Alert';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';

interface TestRunDetailPageProps {
  runId: string;
}

export function TestRunDetailPage({ runId }: TestRunDetailPageProps) {
  const query = useDetailQuery<unknown>(
    'test-run',
    runId ? `/v1/test-runs/${encodeURIComponent(runId)}` : null,
  );
  const run = asRecord(query.data);
  const caseRuns = asRows(run.caseRuns);
  const coverage = asRecord(run.coverage);
  const passed = caseRuns.filter((item) => item.status === 'PASSED').length;
  const passRate = caseRuns.length ? Math.round((passed / caseRuns.length) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="F3-06 · Test Run"
        title="Execution Result"
        description={`Run ${display(run, 'id')} · ${display(run, 'triggerType')}`}
        actions={
          <button className="button" type="button">
            <ShieldCheck size={16} /> Ver Evidencia Auditable
          </button>
        }
      />
      {query.isError ? <Alert tone="error">No fue posible cargar la ejecución.</Alert> : null}
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
          value={display(run, 'durationMs')}
          hint="milliseconds"
          icon={Clock3}
        />
        <MetricCard
          label="Node Coverage"
          value={`${display(coverage, 'nodeCoveragePct')}%`}
          hint="graph nodes"
          icon={Route}
        />
        <MetricCard
          label="Status"
          value={display(run, 'status')}
          hint="final result"
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
                  <tr key={display(item, 'id')}>
                    <td>
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="mono">{display(item, 'testCaseId')}</td>
                    <td>{display(item, 'failureMessage', 'status')}</td>
                    <td>{display(item, 'durationMs')} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Ruta Recorrida" meta="Trace">
          <Timeline
            items={caseRuns.slice(0, 8).map((item) => ({
              title: display(item, 'status'),
              detail: display(item, 'failureMessage', 'testCaseId'),
              meta: `${display(item, 'durationMs')} ms`,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
