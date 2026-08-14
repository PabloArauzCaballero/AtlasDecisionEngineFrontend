'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FlaskConical, Timer } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { ArtifactVersionPicker } from '../components/ArtifactVersionPicker';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { ProgressBar } from '../components/ProgressBar';
import { Panel } from '../components/Panel';
import { useAmbientState } from '../components/ambient/useAmbientState';
import { asRecord, asRows, display, type UnknownRecord } from '../utils/records';
import { QaCounterexampleList } from '../features/qa-lab/QaCounterexampleList';
import { QaRunHistory } from '../features/qa-lab/QaRunHistory';
import { useQaRun } from '../features/qa-lab/useQaRun';
import { usedSeedsOf } from '../features/qa-lab/seed-catalog';
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

  const runs = useQuery({
    queryKey: ['qa-runs', versionId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(
        `/v1/qa-lab/runs?pageSize=20${versionId ? `&artifactVersionId=${encodeURIComponent(versionId)}` : ''}`,
        { signal },
      ),
  });

  const tracking = useQaRun(versionId);
  const { run, active } = tracking;

  // El fondo se mueve mientras el motor trabaja de verdad, no mientras dura el `POST`:
  // ése responde en un instante y la corrida sigue otro par de minutos.
  useAmbientState(active || tracking.launching ? 'running' : 'idle');

  const history = asRows(asRecord(runs.data).items);
  const usedSeeds = usedSeedsOf(history.map((entry) => ({ seed: display(entry, 'seed') })));
  const planned = Number(run.plannedCases ?? 0);
  const done = Number(run.totalCases ?? 0);

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
              versionId={versionId}
              usedSeeds={usedSeeds}
              // Se bloquea mientras la corrida VIVE, no mientras dura el `POST`: lanzar una
              // segunda encima de la primera duplica la carga contra el motor y deja en
              // pantalla dos corridas peleándose por el mismo sitio.
              pending={active || tracking.launching}
              disabled={!versionId}
              onChange={setConfig}
              onRun={() => tracking.launch(toBody(config))}
            />
          </div>
        </Panel>
      ) : null}

      {tracking.error ? <Alert tone="error">{errorMessage(tracking.error)}</Alert> : null}

      {active ? (
        <Panel title="Corrida en marcha">
          <ProgressBar
            value={planned > 0 ? (done / planned) * 100 : 0}
            tone="info"
            label="Casos ejecutados de la corrida"
          />
          <p className="field-hint">
            {planned > 0 ? `${done} de ${planned} casos ejecutados.` : `${done} casos ejecutados.`}{' '}
            La corrida se ejecuta en el motor, no en esta pestaña: puedes irte y volver, o abrirla
            luego desde el historial. El resultado aparece aquí en cuanto termine.
          </p>
        </Panel>
      ) : null}

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
        <QaRunHistory
          history={history}
          onOpen={(runId, seed) => {
            tracking.inspect(runId);
            setConfig((current) => ({ ...current, seed }));
          }}
        />
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
    coverOutcomes: config.coverOutcomes,
    // Vacío se OMITE: mandar {} haría que el motor entendiera «reparte» y rechazara la
    // corrida por no llevar ningún peso mayor que cero.
    outcomeWeights: Object.keys(config.outcomeWeights).length ? config.outcomeWeights : undefined,
  };
}
