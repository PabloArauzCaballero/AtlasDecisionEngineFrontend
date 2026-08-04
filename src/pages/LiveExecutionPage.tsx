import { AlertTriangle, GitBranch, Play } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiEventStream } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { useAmbientState } from '../components/ambient/useAmbientState';
import { ArtifactVersionPicker } from '../components/ArtifactVersionPicker';
import { LiveNodeStepList, type LiveNodeStep } from '../components/LiveNodeStepList';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { JsonPanel } from '../components/JsonPanel';
import { LiveExecutionSampleBar } from '../features/live-execution/LiveExecutionSampleBar';
import { JsonTextarea } from '../components/JsonTextarea';
import { LiveGraph } from '../features/execution-playback/LiveGraph';
import { versionIdFromEvent } from '../features/execution-playback/live-trace';
import { useSafeEnvironments } from '../features/simulator/useSafeEnvironments';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows } from '../utils/records';
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
  const [versionId, setVersionId] = useState('');
  // Vacío a propósito: el ambiente lo eligen los que el motor declara, no una
  // lista escrita a mano en la vista.
  const [environmentCode, setEnvironmentCode] = useState('');
  const [variables, setVariables] = useState('{}');
  const [steps, setSteps] = useState<LiveNodeStep[]>([]);
  const [nested, setNested] = useState<NestedExecutionEntry[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const generation = useRef(0);
  /** Corta la conexión en vuelo: al relanzar y al abandonar la vista. */
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  // El grafo que se ilumina es el de la versión elegida. Si el motor declara la
  // versión en sus eventos, esa manda; si no, vale la que seleccionó el usuario.
  const graphQuery = useDetailQuery<unknown>(
    'live-version-graph',
    versionId ? `/v1/artifact-versions/${encodeURIComponent(versionId)}/graph` : null,
  );
  const graph = asRecord(graphQuery.data);
  const safeEnvironments = useSafeEnvironments(environmentCode, setEnvironmentCode);
  useAmbientState(error ? 'error' : running ? 'running' : result ? 'success' : 'idle');

  const start = async (event: FormEvent) => {
    event.preventDefault();
    const currentGeneration = ++generation.current;
    // La ejecución anterior se corta de verdad, no sólo se ignora: si no, su
    // conexión seguía abierta contra el motor hasta que éste decidiera cerrarla.
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
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
      await apiEventStream(
        `/v1/live-executions/stream?${query.toString()}`,
        (event) => {
          if (currentGeneration !== generation.current) return; // a newer run started
          // Si el motor declara la versión que está ejecutando, se adopta: es más
          // fiable que la elegida a mano y corrige una selección desactualizada.
          const declared = versionIdFromEvent(event.data);
          if (declared) setVersionId((current) => (current === declared ? current : declared));
          if (event.type === 'node_step') {
            setSteps((previous) => [...previous, event.data as LiveNodeStep]);
          } else if (event.type === 'execution_completed') {
            const data = event.data as { nestedExecutions?: NestedExecutionEntry[] };
            setNested(data.nestedExecutions ?? []);
            setResult(event.data);
          } else if (event.type === 'execution_failed') {
            setError(JSON.stringify(event.data));
          }
        },
        { signal: controller.signal },
      );
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
            <ArtifactVersionPicker
              versionId={versionId}
              onVersionChange={setVersionId}
              onArtifactChange={setArtifactCode}
              versionLabel="Versión a dibujar"
              required
            />
            <label className="field">
              <span>Ambiente seguro</span>
              <select
                value={environmentCode}
                disabled={safeEnvironments.isPending || !safeEnvironments.environments.length}
                onChange={(event) => setEnvironmentCode(event.target.value)}
              >
                {safeEnvironments.environments.map((environment) => (
                  <option key={environment.id} value={environment.code}>
                    {environment.name} ({environment.code})
                  </option>
                ))}
              </select>
              {safeEnvironments.isEmpty ? (
                <small className="field-hint">
                  El motor no declara ningún ambiente activo fuera de producción, así que no hay
                  dónde ensayar. Créalo en Ambientes.
                </small>
              ) : null}
            </label>
            {/* Sin valores de prueba, la pantalla arrancaba con `{}` y lo único
                que se podía obtener era VARIABLE_MISSING_OR_INVALID: para ver
                una ejecución había que teclear a mano las decenas de variables
                del contrato. El generador las deriva del contrato REALMENTE
                desplegado, así que no puede quedarse desfasado como lo haría
                una plantilla escrita en el navegador. */}
            <LiveExecutionSampleBar
              artifactCode={artifactCode}
              environmentCode={environmentCode}
              onLoad={(input) => setVariables(JSON.stringify(input, null, 2))}
            />
            <JsonTextarea
              id="live-variables"
              label="Variables (JSON)"
              value={variables}
              onChange={setVariables}
              rows={10}
            />
            <button
              className="button button-primary"
              type="submit"
              disabled={running || !environmentCode}
            >
              <Play size={17} /> {running ? 'Ejecutando…' : 'Iniciar ejecución en vivo'}
            </button>
            {error ? <Alert tone="error">{error}</Alert> : null}
          </form>
        </Panel>
        <Panel title="Progreso nodo por nodo" meta={`${steps.length} eventos`}>
          <LiveGraph
            events={steps}
            nodes={asRows(graph.nodes)}
            edges={asRows(graph.edges)}
            running={running}
          />
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
