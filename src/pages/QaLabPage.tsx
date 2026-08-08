'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FlaskConical, Timer } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { ArtifactVersionPicker } from '../components/ArtifactVersionPicker';
import { EmptyState } from '../components/EmptyState';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useAmbientState } from '../components/ambient/useAmbientState';
import { useNotifications } from '../notifications/useNotifications';
import { asRecord, asRows, display, type UnknownRecord } from '../utils/records';
import { QaCounterexampleList } from '../features/qa-lab/QaCounterexampleList';
import {
  DEFAULT_QA_CONFIG,
  QaRunConfigForm,
  type QaRunConfig,
} from '../features/qa-lab/QaRunConfigForm';

/**
 * QA Lab (§10): genera y ejecuta cientos o miles de casos derivados del contrato del
 * artefacto, y archiva el contraejemplo mínimo de cada propiedad que falle.
 *
 * Todo queda anclado a una semilla, así que una corrida completa puede repetirse
 * exactamente igual meses después — que es lo que convierte un hallazgo en algo que
 * alguien puede depurar.
 */
export function QaLabPage({ initialVersionId = '' }: { initialVersionId?: string }) {
  const [draftId, setDraftId] = useState(initialVersionId);
  const [versionId, setVersionId] = useState(initialVersionId);
  const [config, setConfig] = useState<QaRunConfig>(DEFAULT_QA_CONFIG);
  const [lastRunId, setLastRunId] = useState('');
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  const runs = useQuery({
    queryKey: ['qa-runs', versionId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(
        `/v1/qa-lab/runs?pageSize=20${versionId ? `&artifactVersionId=${encodeURIComponent(versionId)}` : ''}`,
        { signal },
      ),
  });

  const detail = useQuery({
    queryKey: ['qa-run', lastRunId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/qa-lab/runs/${encodeURIComponent(lastRunId)}`, { signal }),
    enabled: Boolean(lastRunId),
  });

  const generate = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(`/v1/qa-lab/versions/${encodeURIComponent(versionId)}/runs`, {
        method: 'POST',
        body: toBody(config),
      }),
    onSuccess: async (run) => {
      setLastRunId(display(run, 'id'));
      notify({
        tone: Number(run.failedCases) > 0 ? 'warning' : 'success',
        title: `Corrida terminada: ${display(run, 'passedCases')}/${display(run, 'totalCases')} casos correctos`,
        description:
          Number(run.failedCases) > 0
            ? `${display(run, 'failedCases')} caso(s) violan alguna propiedad. Revisa los contraejemplos.`
            : `Semilla ${display(run, 'seed')} archivada para reproducir la corrida.`,
      });
      await queryClient.invalidateQueries({ queryKey: ['qa-runs'] });
    },
  });

  useAmbientState(generate.isPending ? 'running' : 'idle');

  const run = asRecord(detail.data ?? generate.data);
  const history = asRows(asRecord(runs.data).items);

  return (
    <>
      <PageHeader
        eyebrow="Calidad"
        title="QA Lab"
        description="Genera datos sintéticos masivos a partir del contrato del algoritmo, ejecuta cada caso y guarda el contraejemplo mínimo de lo que falle."
        hint="Sirve para descubrir los casos que nadie escribió a mano: bordes, tipos incorrectos y combinaciones raras que el contrato debería rechazar."
      />

      <Panel title="Algoritmo a poner a prueba">
        <div data-tutorial-id="qa-lab-version">
          <ArtifactVersionPicker
            versionId={draftId}
            onVersionChange={setDraftId}
            initialVersionId={initialVersionId}
          />
        </div>
        <div className="panel-actions">
          <button
            type="button"
            className="button"
            disabled={!draftId}
            onClick={() => setVersionId(draftId)}
          >
            Usar esta versión
          </button>
        </div>
      </Panel>

      {versionId ? (
        <Panel title="Configuración de la corrida">
          <div data-tutorial-id="qa-lab-config">
            <QaRunConfigForm
              config={config}
              pending={generate.isPending}
              disabled={!versionId}
              onChange={setConfig}
              onRun={() => generate.mutate()}
            />
          </div>
        </Panel>
      ) : null}

      {generate.isError ? <Alert tone="error">{errorMessage(generate.error)}</Alert> : null}

      {run.id ? (
        <>
          <div className="metric-grid" data-tutorial-id="qa-lab-summary">
            <MetricCard
              label="Casos ejecutados"
              value={String(run.totalCases ?? 0)}
              hint="generados a partir del contrato"
              icon={FlaskConical}
            />
            <MetricCard
              label="Correctos"
              value={String(run.passedCases ?? 0)}
              hint="cumplen todas las propiedades"
              icon={CheckCircle2}
              tone="success"
            />
            <MetricCard
              label="Con fallo"
              value={String(run.failedCases ?? 0)}
              hint="violan alguna propiedad"
              icon={AlertTriangle}
              tone={Number(run.failedCases) > 0 ? 'danger' : 'default'}
            />
            <MetricCard
              label="Duración"
              value={`${String(run.durationMs ?? 0)} ms`}
              hint="tiempo total de la corrida"
              icon={Timer}
            />
          </div>
          <Panel
            title="Contraejemplos"
            meta={`semilla ${display(run, 'seed')} · generador ${display(run, 'generatorVersion')}`}
          >
            <div data-tutorial-id="qa-lab-counterexamples">
              <QaCounterexampleList counterexamples={asRows(run.counterexamples)} />
            </div>
          </Panel>
        </>
      ) : null}

      <Panel title="Historial de corridas" meta={`${history.length} corridas`}>
        {history.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Inicio</th>
                <th>Ambiente</th>
                <th>Semilla</th>
                <th>Casos</th>
                <th>Fallos</th>
                <th>Contraejemplos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={display(entry, 'id')}>
                  <td>{new Date(display(entry, 'startedAt')).toLocaleString()}</td>
                  <td>{display(entry, 'environmentCode')}</td>
                  <td>
                    <code>{display(entry, 'seed')}</code>
                  </td>
                  <td>{display(entry, 'totalCases')}</td>
                  <td>{display(entry, 'failedCases')}</td>
                  <td>{display(entry, 'counterexamples')}</td>
                  <td>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        setLastRunId(display(entry, 'id'));
                        setConfig((current) => ({ ...current, seed: display(entry, 'seed') }));
                      }}
                    >
                      Ver / reproducir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            illustration="tests"
            title="Sin corridas todavía"
            description="Elige un algoritmo compilado y lanza una corrida: el generador leerá su contrato y creará casos válidos, de frontera e inválidos por sí solo."
            example="200 casos con 60 % válidos, 15 % de frontera y 25 % inválidos"
          />
        )}
      </Panel>
    </>
  );
}

function toBody(config: QaRunConfig): UnknownRecord {
  return {
    environmentCode: config.environmentCode,
    caseCount: config.caseCount,
    seed: config.seed.trim() || undefined,
    validPercent: config.validPercent,
    boundaryPercent: config.boundaryPercent,
    invalidPercent: config.invalidPercent,
    concurrency: config.concurrency,
    timeoutMs: config.timeoutMs,
    stopOnFirstFailure: config.stopOnFirstFailure,
    checkDeterminism: config.checkDeterminism,
  };
}
