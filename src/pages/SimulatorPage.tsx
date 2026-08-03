import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, GitBranch, Play } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { NodeVariableStatePanel } from '../features/graph-editor/NodeVariableStatePanel';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { PickerSelect } from '../components/PickerSelect';
import { StatusBadge } from '../components/StatusBadge';
import { SimulatorInputEditor } from '../features/simulator/SimulatorInputEditor';
import { useSafeEnvironments } from '../features/simulator/useSafeEnvironments';
import { useNotifications } from '../notifications/useNotifications';
// La consulta de ambientes y su tipo se mudaron a `useSafeEnvironments`; aquí
// sólo queda lo que la vista sigue usando de verdad.
import { simulationResponseSchema, type SimulationResponse } from '../testing/testing.schemas';
import { parseJsonObject } from '../utils/json';
import { asRecord, asRows, display } from '../utils/records';

// El payload arranca VACÍO: en cuanto se elige un artefacto, el editor lo siembra
// con las variables que ese artefacto declara (features/simulator/simulator-payload.ts).
// El ejemplo fijo que había antes pertenecía a otro artefacto y hacía que toda
// simulación terminara en NO_DECISION · VARIABLE_MISSING_OR_INVALID.
const initialPayload = '{}';

function formatValue(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function SimulatorPage() {
  const [artifactCode, setArtifactCode] = useState('');
  // Vacío a propósito: lo rellena el primer ambiente que declare el motor.
  const [environmentCode, setEnvironmentCode] = useState('');
  const [variables, setVariables] = useState(initialPayload);
  const [showTrace, setShowTrace] = useState(false);
  const { notify } = useNotifications();
  const environments = useSafeEnvironments(environmentCode, setEnvironmentCode);
  const safeEnvironments = environments.environments;

  // "Clonar" on an execution detail page leaves the original request here so
  // the operator can replay it as a dry run. Consumed once, then discarded.
  useEffect(() => {
    const raw = sessionStorage.getItem('simulator-prefill');
    if (!raw) return;
    sessionStorage.removeItem('simulator-prefill');
    try {
      const prefill = JSON.parse(raw) as { artifactCode?: string; variables?: unknown };
      if (typeof prefill.artifactCode === 'string' && prefill.artifactCode !== '—') {
        setArtifactCode(prefill.artifactCode.toUpperCase());
      }
      if (prefill.variables && typeof prefill.variables === 'object') {
        setVariables(JSON.stringify(prefill.variables, null, 2));
      }
      notify({
        tone: 'info',
        title: 'Ejecución clonada',
        description:
          'El input original quedó cargado. Ajusta lo necesario y ejecuta la simulación.',
      });
    } catch {
      // A malformed handoff simply falls back to the default payload.
    }
  }, [notify]);

  const simulation = useMutation({
    mutationFn: () => {
      const requestId = crypto.randomUUID();
      return apiRequest(`/v1/simulations/${encodeURIComponent(artifactCode.trim())}`, {
        method: 'POST',
        body: {
          requestId,
          environmentCode,
          variables: parseJsonObject(variables),
          context: { channel: 'DECISION_PORTAL' },
        },
        responseSchema: simulationResponseSchema,
      });
    },
    onSuccess: (decision) => {
      setShowTrace(false);
      notify({
        tone: 'success',
        title: `Simulación completada · ${decision.outcome}`,
        description: `${decision.artifact.code} se evaluó en ${decision.artifact.environment} sin persistir una decisión real.`,
      });
    },
  });
  const result: SimulationResponse | undefined = simulation.data;
  const primaryResult = result?.primaryResult;
  // Un NO_DECISION trae el detalle de qué variable falló: se muestra en claro en
  // vez de dejar sólo el código VARIABLE_MISSING_OR_INVALID.
  const variableErrors = asRows(result?.errors);
  const traceSteps = asRows(asRecord(result?.trace).nodes).length > 0;
  /*
   * Recorrido con el estado de las variables en cada paso. El motor lo devuelve
   * ahora también en simulación, y es lo que permite depurar: ver en qué nodo
   * apareció cada variable intermedia y con qué valor llegó a cada decisión.
   * Si faltara (artefacto compilado antes de §3), se cae al volcado JSON de antes.
   */
  const debugSteps = asRows(asRecord(result?.trace).steps);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    simulation.mutate();
  };

  return (
    <>
      <div className="sandbox-banner">
        <AlertTriangle /> Dry-run seguro · {environmentCode} · no persistente
      </div>
      <PageHeader
        eyebrow="F5-01 · Operations"
        title="Simulador de Decisión"
        description="Ejecuta una evaluación controlada sin crear una decisión productiva ni evidencia runtime."
        hint="Prueba cómo decidiría un algoritmo con las entradas que tú escribas, sin afectar producción ni guardar nada. Ideal para entender por qué el motor toma una ruta."
      />
      {environments.isError ? (
        <Alert tone="error">No fue posible cargar los ambientes seguros de simulación.</Alert>
      ) : null}
      <div className="simulator-layout">
        <Panel title="Configuración" meta="Dry-run no persistente">
          <form className="simulator-form" onSubmit={submit} data-tutorial-id="simulator-form">
            <div className="form-row" data-tutorial-id="simulator-artifact">
              <PickerSelect
                label="Artefacto"
                value={artifactCode}
                onChange={(next) => setArtifactCode(next.toUpperCase())}
                endpoint="/v1/views/pickers/artifacts"
                queryKey="artifacts"
                required
                mapOption={(row) => ({
                  value: display(row, 'artifactCode'),
                  label: `${display(row, 'artifactCode')} · ${display(row, 'name')}`,
                })}
              />
              <label className="field">
                <span>Ambiente seguro</span>
                <select
                  value={environmentCode}
                  disabled={environments.isPending || !safeEnvironments.length}
                  onChange={(event) => setEnvironmentCode(event.target.value)}
                >
                  {safeEnvironments.map((environment) => (
                    <option key={environment.id} value={environment.code}>
                      {environment.name} ({environment.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <SimulatorInputEditor
              artifactCode={artifactCode}
              environmentCode={environmentCode}
              value={variables}
              onChange={setVariables}
            />
            <button
              className="button button-primary"
              disabled={simulation.isPending || !safeEnvironments.length}
              type="submit"
              data-tutorial-id="simulator-submit"
            >
              <Play size={17} /> {simulation.isPending ? 'Simulando…' : 'Ejecutar simulación'}
            </button>
          </form>
        </Panel>
        <Panel title="Resultado de simulación" meta={result?.status ?? 'WAITING'}>
          <div className="simulation-result">
            <StatusBadge value={result?.outcome ?? 'WAITING'} />
            <strong>{formatValue(primaryResult?.value ?? result?.outcome)}</strong>
            {primaryResult ? (
              <small className="primary-result-label">
                Resultado principal · {primaryResult.code}
              </small>
            ) : null}
            <dl className="dynamic-output-grid">
              {Object.entries(result?.output ?? {}).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{formatValue(value)}</dd>
                </div>
              ))}
            </dl>
            {result?.reasonCodes.map((reason) => (
              <article key={reason.code}>
                <span>{reason.code}</span>
                <p>{reason.message ?? reason.category ?? 'Sin mensaje público'}</p>
              </article>
            ))}
            {variableErrors.length ? (
              <Alert tone="warning">
                No se pudo decidir porque faltan o no son válidas estas variables de entrada:
                <ul className="simulator-error-list">
                  {variableErrors.map((error, index) => (
                    <li key={index}>
                      <b>{display(error, 'variableCode', 'code')}</b>{' '}
                      {display(error, 'message', 'errorCode')}
                    </li>
                  ))}
                </ul>
                Corrígelas en el formulario de la izquierda y vuelve a ejecutar.
              </Alert>
            ) : null}
            <button
              className="button"
              type="button"
              disabled={!traceSteps}
              aria-expanded={showTrace}
              onClick={() => setShowTrace((visible) => !visible)}
            >
              <GitBranch size={16} /> {showTrace ? 'Ocultar traza' : 'Ver traza de ejecución'}
            </button>
            {result && !traceSteps ? (
              <small className="field-hint">
                Esta ejecución no recorrió ningún nodo, así que no hay traza que mostrar.
              </small>
            ) : null}
            {showTrace && result ? (
              debugSteps.length ? (
                <div className="simulator-debug">
                  <p className="field-hint">
                    Recorrido paso a paso. Cada nodo muestra qué recibió, qué calculó y qué dejó
                    disponible para los siguientes: así se ve dónde nació cada variable intermedia y
                    con qué valor llegó a la decisión final.
                  </p>
                  <NodeVariableStatePanel trace={debugSteps} />
                </div>
              ) : (
                <JsonPanel label="Traza dry-run" value={result.trace} />
              )
            ) : null}
          </div>
        </Panel>
      </div>
      {simulation.isError ? <Alert tone="error">{errorMessage(simulation.error)}</Alert> : null}
    </>
  );
}
