import { Copy, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert } from '../components/Alert';
import type { AmbientState } from '../components/AmbientBackground';
import { useAmbientState } from '../components/ambient/useAmbientState';
import { ExecutionPlayback } from '../features/execution-playback/ExecutionPlayback';
import { normalizeTrace } from '../features/execution-playback/execution-trace';
import { NodeVariableStatePanel } from '../features/graph-editor/NodeVariableStatePanel';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';

interface ExecutionDetailPageProps {
  executionId: string;
}

export function ExecutionDetailPage({ executionId }: ExecutionDetailPageProps) {
  const query = useDetailQuery<unknown>(
    'execution-detail',
    executionId ? `/v1/audit/executions/${encodeURIComponent(executionId)}` : null,
  );
  const execution = asRecord(query.data);
  const variables = asRows(execution.variables);
  const trace = asRows(execution.traceSteps ?? execution.trace);
  const versionId = display(execution, 'artifactVersionId', 'versionId');
  const router = useRouter();
  // El grafo de la versión ejecutada es lo que da forma a la reproducción. Se
  // pide sólo cuando la ejecución referencia una versión; si falla, el modo de
  // reproducción sigue funcionando con su línea de tiempo.
  const graphQuery = useDetailQuery<unknown>(
    'execution-version-graph',
    versionId !== '—' ? `/v1/artifact-versions/${encodeURIComponent(versionId)}/graph` : null,
  );
  const graph = asRecord(graphQuery.data);
  const steps = normalizeTrace(execution);

  /**
   * Hands the original input to the simulator through sessionStorage — the
   * payload can exceed what a query string tolerates — and navigates there.
   */
  const cloneToSimulator = () => {
    const input = asRecord(execution.inputJson ?? execution.inputSnapshot);
    sessionStorage.setItem(
      'simulator-prefill',
      JSON.stringify({
        artifactCode: display(execution, 'artifactCode'),
        variables: input.variables ?? input,
      }),
    );
    router.push('/simulator');
  };

  // El fondo toma la temperatura del desenlace real de la ejecución.
  const outcome = display(execution, 'status', 'outcome').toUpperCase();
  const ambient: AmbientState = steps.some((step) => step.status === 'error')
    ? 'error'
    : /FAIL|ERROR|REJECT/.test(outcome)
      ? 'error'
      : query.data
        ? 'success'
        : 'idle';
  useAmbientState(ambient);

  return (
    <>
      <PageHeader
        eyebrow="F6-02 · Audit"
        title="Ejecución de Transacción"
        description={`${display(execution, 'requestId')} · ${display(execution, 'artifactCode')}`}
        actions={
          <>
            <button
              className="button"
              type="button"
              disabled={!query.data}
              onClick={cloneToSimulator}
              title="Reproducir esta transacción en el simulador"
            >
              <Copy size={16} /> Clonar
            </button>
            {versionId !== '—' ? (
              <Link
                className="button button-primary"
                href={`/artifact-versions/${encodeURIComponent(versionId)}/graph`}
              >
                <GitBranch size={16} /> Ver Grafo
              </Link>
            ) : (
              <button
                className="button button-primary"
                type="button"
                disabled
                title="La ejecución no referencia una versión de grafo"
              >
                <GitBranch size={16} /> Ver Grafo
              </button>
            )}
          </>
        }
      />
      {query.isError ? <Alert tone="error">No fue posible recuperar la ejecución.</Alert> : null}
      <div className="execution-summary">
        <StatusBadge value={execution.status ?? 'COMPLETADO'} />
        <strong>{display(execution, 'outcome')}</strong>
        <span>{display(execution, 'durationMs')} ms</span>
      </div>
      <Panel title="Metadatos de Contexto" meta="Immutable snapshot">
        <DefinitionGrid
          record={execution}
          items={[
            { label: 'Request ID', keys: ['requestId'], mono: true },
            { label: 'Artifact', keys: ['artifactCode'], mono: true },
            { label: 'Version', keys: ['versionNumber', 'semanticVersion'] },
            { label: 'Environment', keys: ['environmentCode'] },
            { label: 'Principal', keys: ['principalId'], mono: true },
            { label: 'Created At', keys: ['createdAt'] },
          ]}
        />
      </Panel>
      <Panel title="Reproducción de la decisión" meta={`${steps.length} pasos trazados`}>
        <ExecutionPlayback steps={steps} nodes={asRows(graph.nodes)} edges={asRows(graph.edges)} />
      </Panel>
      <div className="execution-detail-grid">
        <main>
          <JsonPanel
            label="Input Payload"
            value={execution.inputJson ?? execution.inputSnapshot ?? {}}
          />
          <JsonPanel
            label="Output Snapshot"
            value={execution.outputJson ?? execution.output ?? {}}
          />
          <Panel title="Variables Resueltas" meta={`${variables.length} variables`}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre Variable</th>
                    <th>Valor Final</th>
                    <th>Origen (Resolver)</th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((item) => (
                    <tr key={display(item, 'id', 'variableCode')}>
                      <td className="mono">{display(item, 'variableCode', 'name')}</td>
                      <td>{display(item, 'valueJson', 'value')}</td>
                      <td>
                        <StatusBadge value={item.sourceType ?? item.source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </main>
        <aside>
          <Panel title="Estado de variables por nodo" meta="entradas · intermedias · salidas">
            <NodeVariableStatePanel trace={trace} />
          </Panel>
          <Panel title="Timeline de Ejecución" meta={`${trace.length} steps`}>
            <Timeline
              items={trace.map((item) => ({
                title: display(item, 'nodeKey', 'nodeType'),
                detail: display(item, 'branchTaken', 'evaluation'),
                meta: `${display(item, 'durationUs')} μs`,
              }))}
            />
          </Panel>
        </aside>
      </div>
    </>
  );
}
