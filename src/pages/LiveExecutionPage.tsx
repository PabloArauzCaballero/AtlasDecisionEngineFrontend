import { AlertTriangle, GitBranch, Play } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { apiEventStream } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { LiveNodeStepList, type LiveNodeStep } from '../components/LiveNodeStepList';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { PickerSelect } from '../components/PickerSelect';
import { JsonPanel } from '../components/JsonPanel';
import { JsonTextarea } from '../components/JsonTextarea';
import { display } from '../utils/records';
import { parseJsonObject } from '../utils/json';

interface NestedExecutionEntry {
  nodeKey: string;
  status: string;
  childArtifactVersionId: string | null;
  durationMs: number;
}

/**
 * Live execution (Fase 8): streams real node-by-node progress over SSE while a
 * decision actually executes — see docs/live-execution.md. This is a dry-run
 * preview tool (SANDBOX/TEST only, no persistence), same policy as the
 * Simulator. Not wired to Rebanada 1's event bus (still in progress on a
 * separate branch); this view drives the engine directly over its own SSE
 * connection and needs nothing from that bus to work.
 */
export function LiveExecutionPage() {
  const [artifactCode, setArtifactCode] = useState('');
  const [environmentCode, setEnvironmentCode] = useState('SANDBOX');
  const [variables, setVariables] = useState('{}');
  const [steps, setSteps] = useState<LiveNodeStep[]>([]);
  const [nested, setNested] = useState<NestedExecutionEntry[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const generation = useRef(0);

  const start = async (event: FormEvent) => {
    event.preventDefault();
    const currentGeneration = ++generation.current;
    setSteps([]);
    setNested([]);
    setResult(null);
    setError(null);
    setRunning(true);

    const query = new URLSearchParams({
      artifactCode,
      environmentCode,
      requestId: crypto.randomUUID(),
      variables: JSON.stringify(parseJsonObject(variables)),
    });

    try {
      await apiEventStream(`/v1/live-executions/stream?${query.toString()}`, (event) => {
        if (currentGeneration !== generation.current) return; // a newer run started
        if (event.type === 'node_step') {
          setSteps((previous) => [...previous, event.data as LiveNodeStep]);
        } else if (event.type === 'execution_completed') {
          const data = event.data as { nestedExecutions?: NestedExecutionEntry[] };
          setNested(data.nestedExecutions ?? []);
          setResult(event.data);
        } else if (event.type === 'execution_failed') {
          setError(JSON.stringify(event.data));
        }
      });
    } catch (caught) {
      if (currentGeneration === generation.current) setError(errorMessage(caught));
    } finally {
      if (currentGeneration === generation.current) setRunning(false);
    }
  };

  return (
    <>
      <div className="sandbox-banner">
        <AlertTriangle /> Vista previa en vivo — SANDBOX/TEST solamente
      </div>
      <PageHeader
        eyebrow="F8 · Live Execution"
        title="Ejecución en vivo"
        description="Observa, nodo por nodo y en tiempo real, cómo el motor recorre el grafo de decisión."
      />
      <div className="simulator-layout">
        <Panel title="Configuración" meta="Live request">
          <form className="simulator-form" onSubmit={start}>
            <div className="form-row">
              <PickerSelect
                label="Artifact Code"
                value={artifactCode}
                onChange={setArtifactCode}
                endpoint="/v1/views/pickers/artifacts"
                queryKey="live-artifacts"
                required
                placeholder="Elegir artefacto…"
                mapOption={(row) => {
                  const code = display(row, 'artifactCode');
                  return code === '—'
                    ? null
                    : { value: code, label: `${code} · ${display(row, 'name')}` };
                }}
              />
              <label className="field">
                <span>Environment</span>
                <select
                  value={environmentCode}
                  onChange={(event) => setEnvironmentCode(event.target.value)}
                >
                  <option>SANDBOX</option>
                  <option>TEST</option>
                </select>
              </label>
            </div>
            <JsonTextarea
              id="live-variables"
              label="Variables (JSON)"
              value={variables}
              onChange={setVariables}
              rows={10}
            />
            <button className="button button-primary" type="submit" disabled={running}>
              <Play size={17} /> {running ? 'Ejecutando…' : 'Iniciar ejecución en vivo'}
            </button>
            {error ? <Alert tone="error">{error}</Alert> : null}
          </form>
        </Panel>
        <Panel title="Progreso nodo por nodo" meta={`${steps.length} eventos`}>
          <LiveNodeStepList steps={steps} />
          {nested.length ? (
            <div className="code-import-preview">
              <h4>
                <GitBranch size={14} aria-hidden="true" /> Subárboles invocados
              </h4>
              <ul className="dependency-list">
                {nested.map((entry, index) => (
                  <li key={index}>
                    <span className="dependency-node-key">{entry.status}</span>
                    {entry.nodeKey} ({entry.durationMs}ms)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      </div>
      {result ? <JsonPanel value={result} label="Resultado final" /> : null}
    </>
  );
}
