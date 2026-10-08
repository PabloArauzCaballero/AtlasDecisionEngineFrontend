import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, GitBranch, ListChecks, Route } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { statusText } from '../contracts/status-labels';
import { Alert } from '../components/Alert';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { PickerSelect } from '../components/PickerSelect';
import { newestFirst, usePickerDefault } from '../components/usePickerDefault';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import {
  coveragePercentage,
  testRunSchema,
  type TestCase,
  type TestRun,
} from '../testing/testing.schemas';
import { downloadJson } from '../utils/download';
import { display } from '../utils/records';
import { ScrollRegion } from '../components/ScrollRegion';

interface GraphCoveragePageProps {
  initialRunId?: string;
}

function traceTerminal(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const trace = (value as Record<string, unknown>).trace;
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) return null;
  const terminal = (trace as Record<string, unknown>).terminal;
  return typeof terminal === 'string' && terminal ? terminal : null;
}

function caseLabel(testCase: TestCase | undefined, fallback: string): string {
  return testCase ? `${testCase.caseCode} · ${testCase.testName}` : fallback;
}

/** Join a coverage detail list defensively, whatever shape the backend sends. */
function detailList(value: unknown): string {
  return Array.isArray(value) && value.length ? value.map(String).join(', ') : 'ninguno';
}

export function GraphCoveragePage({ initialRunId = '' }: GraphCoveragePageProps) {
  const [draftId, setDraftId] = useState(initialRunId);
  // `null` = nadie eligió todavía: se abre con la corrida terminada más reciente.
  const [chosenRunId, setRunId] = useState<string | null>(initialRunId || null);
  const autoRunId = usePickerDefault({
    endpoint: '/v1/views/pickers/test-runs',
    queryKey: 'test-runs',
    enabled: chosenRunId === null,
    // Una corrida que terminó tiene cobertura que enseñar; una en cola, todavía no.
    rank: (a, b) =>
      Number(Boolean(b.finishedAt)) - Number(Boolean(a.finishedAt)) || newestFirst(a, b),
  });
  const runId = chosenRunId ?? autoRunId;
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
  const coverage = run?.coverage ?? [];
  const caseRuns = run?.caseRuns ?? [];
  const nodePct = coveragePercentage(coverage, 'NODE');
  const edgePct = coveragePercentage(coverage, 'EDGE');
  const terminalPct = coveragePercentage(coverage, 'TERMINAL');
  const nonTerminalRuns = caseRuns.filter((item) => !traceTerminal(item.actualResultJson));
  const inProgress = run?.status === 'QUEUED' || run?.status === 'RUNNING';

  const exportReport = (current: TestRun) =>
    downloadJson(`test-run-${current.id}-coverage.json`, {
      runId: current.id,
      status: current.status,
      coverage: current.coverage,
      nonTerminalCases: nonTerminalRuns.map((item) => ({
        caseId: item.testCaseId,
        caseCode: item.testCase?.caseCode,
        resultStatus: item.resultStatus,
        error: item.errorJson,
      })),
    });

  return (
    <>
      <PageHeader
        eyebrow="Calidad"
        title="Cobertura del diagrama"
        description="Qué pasos y caminos del algoritmo recorrieron las pruebas, y cuáles quedaron sin probar."
        actions={
          <button
            className="button"
            type="button"
            disabled={!run || inProgress}
            onClick={() => run && exportReport(run)}
          >
            <Download size={16} /> Exportar Reporte
          </button>
        }
      />
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setRunId((draftId || runId).trim());
        }}
      >
        <PickerSelect
          label="Corrida de pruebas"
          value={draftId || runId}
          onChange={setDraftId}
          endpoint="/v1/views/pickers/test-runs"
          queryKey="test-runs"
          placeholder="Elegir corrida…"
          mapOption={(row) => ({
            value: display(row, 'id'),
            label: `Corrida ${display(row, 'id')} · ${display(row, 'suiteCode')} · ${statusText(row.status)}`,
          })}
        />
        <button className="button button-primary" type="submit">
          Cargar cobertura
        </button>
      </form>
      {query.isError ? (
        <Alert tone="error">
          No fue posible recuperar la cobertura de esta corrida: {errorMessage(query.error)}
        </Alert>
      ) : null}
      {inProgress ? (
        <Alert tone="info">
          La corrida está {run?.status === 'QUEUED' ? 'en cola' : 'en ejecución'}; la cobertura se
          actualizará automáticamente al terminar.
        </Alert>
      ) : null}
      <div className="metric-grid">
        <MetricCard
          label="Casos corridos"
          value={String(caseRuns.length)}
          hint="total cases"
          icon={ListChecks}
        />
        <MetricCard
          label="Pasos recorridos"
          value={`${nodePct.toFixed(1)}%`}
          hint="nodes reached"
          icon={GitBranch}
          tone="success"
        />
        <MetricCard
          label="Conexiones recorridas"
          value={`${edgePct.toFixed(1)}%`}
          hint="edges traversed"
          icon={Route}
        />
        <MetricCard
          label="Caminos que no llegan a un final"
          value={String(nonTerminalRuns.length)}
          hint="requires attention"
          icon={AlertTriangle}
        />
      </div>
      <div className="coverage-layout">
        <Panel title="Elementos cubiertos y pendientes" meta="Evidencia del motor">
          <div className="coverage-bars">
            {coverage.map((item) => (
              <div key={item.coverageType}>
                <span>
                  {item.coverageType}
                  <b>
                    {item.coveredCount}/{item.totalCount}
                  </b>
                </span>
                <p>
                  Cubiertos: {detailList(item.detailsJson?.covered)}
                  <br />
                  Pendientes: {detailList(item.detailsJson?.missing)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Cobertura por tipo" meta="Porcentaje">
          <div className="coverage-bars">
            {[
              ['Pasos', nodePct],
              ['Conexiones', edgePct],
              ['Finales', terminalPct],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>
                  {label}
                  <b>{Number(value).toFixed(1)}%</b>
                </span>
                <ProgressBar
                  value={Number(value)}
                  label={String(label)}
                  tone={Number(value) >= 80 ? 'success' : 'warning'}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Caminos que no llegan a un final" meta="Revisión del recorrido">
        <ScrollRegion label="Cobertura por nodo">
          <table>
            <thead>
              <tr>
                <th scope="col">Caso</th>
                <th scope="col">Resultado</th>
                <th scope="col">Final alcanzado</th>
                <th scope="col">Error</th>
              </tr>
            </thead>
            <tbody>
              {nonTerminalRuns.map((item) => (
                <tr key={item.id}>
                  <td>{caseLabel(item.testCase, item.testCaseId)}</td>
                  <td>
                    <StatusBadge value={item.resultStatus} />
                  </td>
                  <td>Sin final</td>
                  <td>{item.errorJson ? JSON.stringify(item.errorJson) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </Panel>
    </>
  );
}
