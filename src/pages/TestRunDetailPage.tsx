import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Route, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { apiRequest } from '../api/http-client';
import { statusText } from '../contracts/status-labels';
import { Alert } from '../components/Alert';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { TestCaseRunDetail } from '../features/testing/TestCaseRunDetail';
import type { UnknownRecord } from '../utils/records';
import { Timeline } from '../components/Timeline';
import { coveragePercentage, testRunSchema } from '../testing/testing.schemas';
import { downloadJson } from '../utils/download';

interface TestRunDetailPageProps {
  runId: string;
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
        eyebrow="Calidad · Corrida de pruebas"
        title="Resultado de la corrida"
        description={`Corrida ${run?.id ?? runId}`}
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
          label="Casos correctos"
          value={`${passRate}%`}
          hint={`${passed} de ${caseRuns.length} casos`}
          icon={CheckCircle2}
          tone="success"
        />
        <MetricCard
          label="Duración"
          value={String(run?.durationMs ?? 0)}
          hint="milisegundos"
          icon={Clock3}
        />
        <MetricCard
          label="Pasos del algoritmo recorridos"
          value={`${nodeCoverage.toFixed(1)}%`}
          hint="del diagrama"
          icon={Route}
        />
        <MetricCard
          label="Estado"
          value={run ? statusText(run.status) : 'Cargando…'}
          hint="de la corrida"
          icon={ShieldCheck}
        />
      </div>
      <div className="result-layout">
        <Panel title="Casos de la corrida" meta={`${caseRuns.length} casos`}>
          {/* Cada caso se abre: entradas, esperado contra obtenido y el camino
              que recorrió. Antes sólo se veía el estado y, si fallaba, las
              aserciones rotas; de un caso que PASA no se veía nada, así que no
              había forma de revisar POR QUÉ aprobó — que es justo lo que
              pregunta un auditor. Los datos ya venían en la respuesta. */}
          <div className="case-run-list">
            {caseRuns.map((item) => (
              <TestCaseRunDetail key={item.id} caseRun={item as unknown as UnknownRecord} />
            ))}
          </div>
          {!caseRuns.length ? (
            <div className="empty-state">Esta corrida no ejecutó ningún caso.</div>
          ) : null}
        </Panel>
        <Panel title="Resumen de casos" meta="Recorrido">
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
