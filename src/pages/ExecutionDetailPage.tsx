import { Copy, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert } from '../components/Alert';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { TutorialButton } from '../features/tutorial/TutorialButton';
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

  return (
    <>
      <PageHeader
        eyebrow="F6-02 · Audit"
        title="Ejecución de Transacción"
        description={`${display(execution, 'requestId')} · ${display(execution, 'artifactCode')}`}
        actions={
          <>
            <TutorialButton tutorialId="execution-detail" />
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
