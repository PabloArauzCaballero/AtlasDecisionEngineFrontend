import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, GitBranch, Play } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { PickerSelect } from '../components/PickerSelect';
import { StatusBadge } from '../components/StatusBadge';
import { SimulatorInputEditor } from '../features/simulator/SimulatorInputEditor';
import { useNotifications } from '../notifications/useNotifications';
import {
  environmentsSchema,
  simulationResponseSchema,
  type Environment,
  type SimulationResponse,
} from '../testing/testing.schemas';
import { parseJsonObject } from '../utils/json';
import { display } from '../utils/records';

const initialPayload = JSON.stringify(
  { requestedAmount: 1500, monthlyIncome: 5000, daysPastDue: 0, customerSegment: 'NEW' },
  null,
  2,
);
const noEnvironments: Environment[] = [];

function formatValue(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function SimulatorPage() {
  const [artifactCode, setArtifactCode] = useState('');
  const [environmentCode, setEnvironmentCode] = useState('SANDBOX');
  const [variables, setVariables] = useState(initialPayload);
  const [showTrace, setShowTrace] = useState(false);
  const { notify } = useNotifications();
  const environments = useQuery({
    queryKey: ['simulation-environments'],
    queryFn: ({ signal }) =>
      apiRequest('/v1/environments', { signal, responseSchema: environmentsSchema }),
    select: (items) =>
      items.filter(
        (environment) =>
          environment.status === 'ACTIVE' &&
          !environment.isProduction &&
          environment.code.toUpperCase() !== 'PROD',
      ),
  });
  const safeEnvironments = environments.data ?? noEnvironments;

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

  useEffect(() => {
    if (
      safeEnvironments.length &&
      !safeEnvironments.some((environment) => environment.code === environmentCode)
    ) {
      setEnvironmentCode(safeEnvironments[0]?.code ?? 'SANDBOX');
    }
  }, [environmentCode, safeEnvironments]);

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
      />
      {environments.isError ? (
        <Alert tone="error">No fue posible cargar los ambientes seguros de simulación.</Alert>
      ) : null}
      <div className="simulator-layout">
        <Panel title="Configuración" meta="Dry-run no persistente">
          <form className="simulator-form" onSubmit={submit} data-tutorial-id="simulator-form">
            <div className="form-row">
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
            <button
              className="button"
              type="button"
              disabled={!result}
              aria-expanded={showTrace}
              onClick={() => setShowTrace((visible) => !visible)}
            >
              <GitBranch size={16} /> {showTrace ? 'Ocultar traza' : 'Ver traza de ejecución'}
            </button>
            {showTrace && result ? <JsonPanel label="Traza dry-run" value={result.trace} /> : null}
          </div>
        </Panel>
      </div>
      {simulation.isError ? <Alert tone="error">{errorMessage(simulation.error)}</Alert> : null}
    </>
  );
}
