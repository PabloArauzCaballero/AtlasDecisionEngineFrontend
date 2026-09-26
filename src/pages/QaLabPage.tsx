'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { ArtifactVersionPicker } from '../components/ArtifactVersionPicker';
import { PageHeader } from '../components/PageHeader';
import { ProgressBar } from '../components/ProgressBar';
import { Panel } from '../components/Panel';
import { useAmbientState } from '../components/ambient/useAmbientState';
import { asRecord, asRows, display, type UnknownRecord } from '../utils/records';
import { QaRunHistory } from '../features/qa-lab/QaRunHistory';
import { QaRunResult } from '../features/qa-lab/QaRunResult';
import { useQaRun } from '../features/qa-lab/useQaRun';
import { usedSeedsOf } from '../features/qa-lab/seed-catalog';
import { configFromArchive } from '../features/qa-lab/qa-run-archive';
import { toRunBody } from '../features/qa-lab/qa-run-config';
import {
  DEFAULT_QA_CONFIG,
  QaRunConfigForm,
  type QaRunConfig,
} from '../features/qa-lab/QaRunConfigForm';

/**
 * QA Lab (§10): genera y ejecuta cientos o miles de casos derivados del contrato del
 * artefacto, y archiva el contraejemplo mínimo de cada comprobación que falle.
 *
 * Una corrida se repite exactamente igual con su semilla, su configuración y la misma
 * versión: «Reproducir» devuelve las tres al formulario.
 */
export function QaLabPage({ initialVersionId = '' }: { initialVersionId?: string }) {
  const [draftId, setDraftId] = useState(initialVersionId);
  const [versionId, setVersionId] = useState(initialVersionId);
  const [config, setConfig] = useState<QaRunConfig>(DEFAULT_QA_CONFIG);
  // Corrida cuya configuración hay que volver a poner en el formulario en cuanto llegue su
  // detalle: el historial sólo trae la fila resumida, no la configuración archivada.
  const [restoring, setRestoring] = useState('');

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

  useEffect(() => {
    if (!restoring || String(run.id ?? '') !== restoring) return;
    setRestoring('');
    setConfig(configFromArchive(run.config, String(run.seed ?? '')));
    const version = String(run.artifactVersionId ?? '');
    if (version) {
      setDraftId(version);
      setVersionId(version);
    }
  }, [restoring, run]);

  const history = asRows(asRecord(runs.data).items);
  const usedSeeds = usedSeedsOf(history.map((entry) => ({ seed: display(entry, 'seed') })));
  const planned = Number(run.plannedCases ?? 0);
  const done = Number(run.totalCases ?? 0);
  const reproduce = (runId: string) => {
    setRestoring(runId);
    tracking.inspect(runId);
  };

  return (
    <>
      <PageHeader
        eyebrow="Calidad"
        title="QA Lab"
        description="Inventa cientos de casos a partir de las reglas de entrada del algoritmo, los ejecuta en el motor y te guarda, reducido, cada caso que incumple una comprobación."
        hint="Encuentra lo que nadie escribió a mano: bordes, datos del tipo equivocado y combinaciones raras que las reglas deberían rechazar. Comprueba el contrato y la ejecución, no si la decisión es buena para el negocio."
      />

      <Panel title="Algoritmo a poner a prueba">
        <div data-tutorial-id="qa-lab-version">
          <ArtifactVersionPicker
            versionId={draftId}
            onVersionChange={setDraftId}
            initialVersionId={initialVersionId}
            requireCompiled
          />
        </div>
        <div className="panel-actions">
          <button
            type="button"
            className="button"
            disabled={!draftId}
            onClick={() => setVersionId(draftId)}
            data-tutorial-id="qa-lab-use-version"
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
              // segunda encima de la primera duplica la carga contra el motor.
              pending={active || tracking.launching}
              disabled={!versionId}
              onChange={setConfig}
              onRun={() => tracking.launch(toRunBody(config))}
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
        <QaRunResult run={run} active={active} onReproduce={() => reproduce(String(run.id))} />
      ) : null}

      <Panel title="Historial de corridas" meta={`${history.length} corridas`}>
        <div data-tutorial-id="qa-lab-history">
          <QaRunHistory history={history} onOpen={tracking.inspect} onReproduce={reproduce} />
        </div>
      </Panel>
    </>
  );
}
