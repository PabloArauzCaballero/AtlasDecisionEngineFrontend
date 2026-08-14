import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, GitBranch, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { NodeVariableStatePanel } from '../features/graph-editor/NodeVariableStatePanel';
import { TraceActions } from '../features/execution-playback/TraceActions';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { PickerSelect } from '../components/PickerSelect';
import type { ImportedCase } from '../features/simulator/sample-import';
import {
  batchCases,
  runSimulationBatch,
  type BatchEntry,
} from '../features/simulator/simulation-batch';
import { SimulationResultPanel } from '../features/simulator/SimulationResultPanel';
import { SimulatorInputEditor } from '../features/simulator/SimulatorInputEditor';
import { useArtifactContract, variableNames } from '../features/simulator/useArtifactContract';
import { useArtifactDeployments } from '../features/simulator/useArtifactDeployments';
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

export function SimulatorPage() {
  const [artifactCode, setArtifactCode] = useState('');
  // Vacío a propósito: lo rellena el primer ambiente que declare el motor.
  const [environmentCode, setEnvironmentCode] = useState('');
  const [variables, setVariables] = useState(initialPayload);
  const [showTrace, setShowTrace] = useState(false);
  // La tanda generada o importada, y cuál de sus resultados se está mirando.
  const [batch, setBatch] = useState<ImportedCase[]>([]);
  const [activeResult, setActiveResult] = useState(0);
  /*
   * Cuál de la tanda edita el formulario. Sin esto, al ejecutar se enviaba la
   * tanda tal como se generó y todo lo tecleado después se perdía en silencio:
   * el motor contestaba «falta la variable X» sobre un formulario que la
   * enseñaba rellena.
   */
  const [editingCase, setEditingCase] = useState(0);
  const { notify } = useNotifications();
  const environments = useSafeEnvironments(environmentCode, setEnvironmentCode);
  const safeEnvironments = environments.environments;
  /*
   * Dónde está desplegado el artefacto elegido. Se consulta ANTES de ejecutar
   * para no ofrecer una combinación que el motor va a rechazar con
   * `ACTIVE_DEPLOYMENT_NOT_FOUND` después de rellenar todo el formulario.
   */
  const deployments = useArtifactDeployments(artifactCode);
  const deployedHere = deployments.has(environmentCode);
  const canSimulate = Boolean(artifactCode) && safeEnvironments.length > 0 && deployedHere;

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

  /**
   * Una petición por caso. Cada una lleva su propio `requestId`: repetirlo haría
   * que el motor tratara la segunda como un reintento de la primera.
   */
  const simulateOne = (input: Record<string, unknown>) =>
    apiRequest(`/v1/simulations/${encodeURIComponent(artifactCode.trim())}`, {
      method: 'POST',
      body: {
        requestId: crypto.randomUUID(),
        environmentCode,
        variables: input,
        context: { channel: 'DECISION_PORTAL' },
      },
      responseSchema: simulationResponseSchema,
    });

  const simulation = useMutation({
    mutationFn: () =>
      runSimulationBatch(batchCases(batch, parseJsonObject(variables), editingCase), simulateOne),
    onSuccess: (results) => {
      setShowTrace(false);
      setActiveResult(0);
      const decided = results.filter((entry) => entry.decision).length;
      notify({
        tone: decided ? 'success' : 'warning',
        title:
          results.length > 1
            ? `${decided} de ${results.length} casos simulados`
            : `Simulación completada · ${results[0]?.decision?.outcome ?? 'sin desenlace'}`,
        description: `${artifactCode} se evaluó en ${environmentCode} sin persistir ninguna decisión real.`,
      });
    },
  });
  const entries: BatchEntry[] = simulation.data ?? [];
  const result: SimulationResponse | undefined = entries[activeResult]?.decision;
  /*
   * Los nombres se piden para el artefacto que PRODUJO el resultado, no para el
   * que esté elegido ahora: cambiar de artefacto tras simular dejaría la
   * decisión anterior en pantalla rotulada con los nombres de otro contrato.
   * Mientras no se cambia —el caso normal— es la misma consulta que ya hizo el
   * editor de entrada, así que comparten clave y no se pide dos veces.
   */
  const contract = useArtifactContract(result?.artifact.code ?? artifactCode);
  const outputNames = useMemo(() => variableNames(contract.data), [contract.data]);
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
                      {/* Se marca, no se oculta: saber que un ambiente existe y
                          que el artefacto no está allí es información útil. */}
                      {artifactCode && !deployments.has(environment.code)
                        ? ' — sin despliegue activo'
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {artifactCode && !deployedHere ? (
              <Alert tone="warning">
                <strong>{artifactCode}</strong> no tiene un despliegue activo en{' '}
                <strong>{environmentCode}</strong>, y el simulador ejecuta el artefacto compilado
                que está desplegado: sin uno, no hay nada que simular.
                {deployments.environmentCodes.length ? (
                  <> Sí está desplegado en {deployments.environmentCodes.join(', ')}.</>
                ) : (
                  <> No está desplegado en ningún ambiente todavía.</>
                )}{' '}
                <Link href="/deployments">Ir a Despliegues</Link>
              </Alert>
            ) : null}
            <SimulatorInputEditor
              artifactCode={artifactCode}
              environmentCode={environmentCode}
              value={variables}
              onChange={setVariables}
              onCases={setBatch}
              onActiveCase={setEditingCase}
            />
            <button
              className="button button-primary"
              disabled={simulation.isPending || !canSimulate}
              type="submit"
              data-tutorial-id="simulator-submit"
            >
              <Play size={17} /> {simulation.isPending ? 'Simulando…' : 'Ejecutar simulación'}
            </button>
          </form>
        </Panel>
        <SimulationResultPanel
          entries={entries}
          index={activeResult}
          names={outputNames}
          onIndex={(next) => {
            setActiveResult(next);
            // La traza pertenece al caso que se estaba mirando: dejarla abierta
            // al cambiar de caso enseñaría el recorrido del anterior.
            setShowTrace(false);
          }}
        >
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
        </SimulationResultPanel>
      </div>
      {/*
        La traza va DEBAJO de las dos columnas, a lo ancho, y no dentro del panel
        de resultado.
        Medido: en la columna de resultado el contenedor daba 294 px y la tabla
        necesitaba 622 —seis columnas: variable, antes, después, productora,
        creada en, consumida por—. Desplazaba, sí, pero enseñaba menos de la
        mitad y la barra horizontal de un panel interior es fácil de no ver:
        parecía que la traza salía cortada. A lo ancho cabe entera.
      */}
      {showTrace && result ? (
        debugSteps.length ? (
          <Panel title="Traza de ejecución" meta={`${debugSteps.length} pasos`}>
            <div className="simulator-debug">
              <p className="field-hint">
                Recorrido paso a paso. Cada nodo muestra qué recibió, qué calculó y qué dejó
                disponible para los siguientes: así se ve dónde nació cada variable intermedia y con
                qué valor llegó a la decisión final.
              </p>
              {/* Una traza se mira aquí pero se analiza en otro sitio: en un
                  ticket, comparada con la de ayer, o pasada por `jq`. */}
              <TraceActions trace={result.trace} name={result.requestId} />
              <NodeVariableStatePanel trace={debugSteps} />
            </div>
          </Panel>
        ) : (
          <Panel title="Traza dry-run" meta="sin recorrido por nodo">
            <TraceActions trace={result.trace} name={result.requestId} />
            <JsonPanel label="Traza dry-run" value={result.trace} />
          </Panel>
        )
      ) : null}
      {simulation.isError ? <Alert tone="error">{errorMessage(simulation.error)}</Alert> : null}
    </>
  );
}
