import { AlertTriangle, Download, GitBranch, ListChecks, Route } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';

export function GraphCoveragePage() {
  const params = useParams();
  const [draftId, setDraftId] = useState(params.runId ?? '');
  const [runId, setRunId] = useState(params.runId ?? '');
  const query = useDetailQuery<unknown>('graph-coverage', runId ? `/v1/test-runs/${runId}` : null);
  const run = asRecord(query.data);
  const coverage = asRecord(run.coverage);
  const caseRuns = asRows(run.caseRuns);
  const nodePct = Number(coverage.nodeCoveragePct ?? 0);
  const edgePct = Number(coverage.edgeCoveragePct ?? 0);
  return (
    <>
      <PageHeader
        eyebrow="F3-07 · Quality"
        title="Cobertura de Grafo"
        description="Análisis de rutas críticas, nodos alcanzados y caminos sin terminación."
        actions={
          <button className="button" type="button">
            <Download size={16} /> Exportar Reporte
          </button>
        }
      />
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setRunId(draftId);
        }}
      >
        <label>
          <span>Test Run ID</span>
          <input value={draftId} onChange={(event) => setDraftId(event.target.value)} />
        </label>
        <button className="button button-primary" type="submit">
          Load coverage
        </button>
      </form>
      {query.isError ? <Alert tone="error">No fue posible recuperar la cobertura.</Alert> : null}
      <div className="metric-grid">
        <MetricCard
          label="Casos Ejecutados"
          value={String(caseRuns.length)}
          hint="total cases"
          icon={ListChecks}
        />
        <MetricCard
          label="Node Coverage"
          value={`${nodePct}%`}
          hint="nodes reached"
          icon={GitBranch}
          tone="success"
        />
        <MetricCard
          label="Edge Coverage"
          value={`${edgePct}%`}
          hint="edges traversed"
          icon={Route}
        />
        <MetricCard
          label="Non-terminal Paths"
          value={display(coverage, 'nonTerminalPaths')}
          hint="requires attention"
          icon={AlertTriangle}
        />
      </div>
      <div className="coverage-layout">
        <Panel title="Mapa de Calor (Ruta Crítica)" meta="Interactive graph">
          <div className="heat-graph">
            <div className="heat-node success">Trigger</div>
            <span>→</span>
            <div className="heat-node success">Policy</div>
            <span>→</span>
            <div className="heat-node warning">Score</div>
            <span>→</span>
            <div className="heat-node danger">Manual Review</div>
          </div>
        </Panel>
        <Panel title="Cobertura por Tipo" meta="Percent">
          <div className="coverage-bars">
            {[
              ['Nodes', nodePct],
              ['Edges', edgePct],
              ['Terminals', Number(coverage.terminalCoveragePct ?? 0)],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>
                  {label}
                  <b>{value}%</b>
                </span>
                <ProgressBar
                  value={Number(value)}
                  tone={Number(value) >= 80 ? 'success' : 'warning'}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Rutas No Terminales Detectadas" meta="Trace inspection">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID Ruta</th>
                <th>Nodo Origen</th>
                <th>Nodo Final Alcanzado</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {caseRuns
                .filter((item) => item.status !== 'PASSED')
                .map((item) => (
                  <tr key={display(item, 'id')}>
                    <td className="mono">{display(item, 'id')}</td>
                    <td>{display(item, 'testCaseId')}</td>
                    <td>{display(item, 'status')}</td>
                    <td>{display(item, 'failureMessage')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
