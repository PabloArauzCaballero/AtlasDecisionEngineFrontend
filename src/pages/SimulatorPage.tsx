import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, GitBranch, Play } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { JsonTextarea } from '../components/JsonTextarea';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { parseJsonObject } from '../utils/json';
import { asRecord, asRows, display } from '../utils/records';

const initialPayload = JSON.stringify(
  { requestedAmount: 1500, monthlyIncome: 5000, daysPastDue: 0, customerSegment: 'NEW' },
  null,
  2,
);

export function SimulatorPage() {
  const [artifactCode, setArtifactCode] = useState('');
  const [environmentCode, setEnvironmentCode] = useState('SANDBOX');
  const [variables, setVariables] = useState(initialPayload);
  const simulation = useMutation({
    mutationFn: () => {
      const id = crypto.randomUUID();
      return apiRequest<unknown>(`/v1/decisions/${encodeURIComponent(artifactCode)}`, {
        method: 'POST',
        body: {
          requestId: id,
          idempotencyKey: id,
          environmentCode,
          variables: parseJsonObject(variables),
          context: { channel: 'DECISION_PORTAL' },
        },
      });
    },
  });
  const result = asRecord(simulation.data);
  const reasons = asRows(result.reasonCodes ?? result.reasons);
  const output = asRecord(result.output);
  const primaryResult = asRecord(result.primaryResult);
  const hasPrimaryResult = primaryResult.value !== undefined && primaryResult.value !== null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    simulation.mutate();
  };
  return (
    <>
      <div className="sandbox-banner">
        <AlertTriangle /> Safe Environment: Sandbox
      </div>
      <PageHeader
        eyebrow="F5-01 · Operations"
        title="Simulador de Decisión"
        description="Execute a governed decision with controlled input and inspect its explainable result."
      />
      <div className="simulator-layout">
        <Panel title="Configuration" meta="Runtime request">
          <form className="simulator-form" onSubmit={submit}>
            <div className="form-row">
              <label className="field">
                <span>Artifact</span>
                <input
                  required
                  value={artifactCode}
                  onChange={(event) => setArtifactCode(event.target.value.toUpperCase())}
                />
              </label>
              <label className="field">
                <span>Environment</span>
                <select
                  value={environmentCode}
                  onChange={(event) => setEnvironmentCode(event.target.value)}
                >
                  <option>SANDBOX</option>
                  <option>TEST</option>
                  <option>PROD</option>
                </select>
              </label>
            </div>
            <JsonTextarea
              id="variables"
              label="Input Variables (JSON)"
              value={variables}
              onChange={setVariables}
              rows={16}
            />
            <button className="button button-primary" disabled={simulation.isPending} type="submit">
              <Play size={17} /> {simulation.isPending ? 'Running…' : 'Run Simulation'}
            </button>
          </form>
        </Panel>
        <Panel title="Simulation Results" meta={display(result, 'status')}>
          <div className="simulation-result">
            <StatusBadge value={result.outcome ?? 'WAITING'} />
            <strong>
              {hasPrimaryResult
                ? display(primaryResult, 'value')
                : display(result, 'outcome', 'status')}
            </strong>
            {hasPrimaryResult ? (
              <small className="primary-result-label">
                Resultado principal · {display(primaryResult, 'code')}
              </small>
            ) : null}
            <dl className="dynamic-output-grid">
              {Object.entries(output).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                </div>
              ))}
            </dl>
            {reasons.map((reason) => (
              <article key={display(reason, 'code')}>
                <span>{display(reason, 'code')}</span>
                <p>{display(reason, 'message', 'publicMessage')}</p>
              </article>
            ))}
            <button className="button" type="button">
              <GitBranch size={16} /> View Execution Trace
            </button>
          </div>
        </Panel>
      </div>
      {simulation.isError ? <Alert tone="error">{errorMessage(simulation.error)}</Alert> : null}
    </>
  );
}
