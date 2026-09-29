'use client';

import { AlertTriangle, CheckCircle2, FlaskConical, RotateCcw, Timer } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { MetricCard } from '../../components/MetricCard';
import { Panel } from '../../components/Panel';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { QaCounterexampleList } from './QaCounterexampleList';
import { STOP_REASON_TEXT, fakerNoteOf, runFailureOf } from './qa-run-archive';

interface Props {
  run: UnknownRecord;
  /** Sigue trabajando: la duración todavía no existe. */
  active: boolean;
  onReproduce: () => void;
}

/**
 * El resultado de una corrida: cuántos casos, cuántos fallaron, por qué se cortó o se
 * interrumpió si fue el caso, de dónde salieron los datos y los contraejemplos.
 *
 * Todo lo que la corrida archiva se dice aquí. Antes una corrida interrumpida mandaba a
 * «abrir su detalle para ver el motivo» y el detalle no lo enseñaba, y una corrida parada en
 * el primer fallo se leía como si hubiera recorrido el lote entero.
 */
export function QaRunResult({ run, active, onReproduce }: Props) {
  const failure = runFailureOf(run);
  const stopped = STOP_REASON_TEXT[String(run.stoppedReason ?? '')];
  const fakers = fakerNoteOf(run.fakers);
  const planned = Number(run.plannedCases ?? 0);
  const executed = Number(run.executedCases ?? run.totalCases ?? 0);
  const tooling = asRecord(run.tooling);

  return (
    <>
      <div className="metric-grid" data-tutorial-id="qa-lab-summary">
        <MetricCard
          label="Casos ejecutados"
          value={String(run.totalCases ?? 0)}
          hint={planned > 0 ? `de ${planned} planificados` : 'generados a partir del contrato'}
          icon={FlaskConical}
        />
        <MetricCard
          label="Correctos"
          value={String(run.passedCases ?? 0)}
          hint="cumplen todas las comprobaciones"
          icon={CheckCircle2}
          tone="success"
        />
        <MetricCard
          label="Con fallo"
          value={String(run.failedCases ?? 0)}
          hint="incumplen alguna comprobación"
          icon={AlertTriangle}
          tone={Number(run.failedCases) > 0 ? 'danger' : 'default'}
        />
        <MetricCard
          label="Duración"
          value={active ? 'en curso' : `${(Number(run.durationMs ?? 0) / 1000).toFixed(1)} s`}
          hint="generar, ejecutar, reducir los fallos y guardarlos, dentro del motor"
          icon={Timer}
        />
      </div>

      {failure ? (
        <Alert tone="error">
          <b>{failure.title}</b> {failure.detail}
        </Alert>
      ) : null}
      {stopped && !active ? (
        <Alert tone="warning">
          {stopped} Ejecutó {executed} de {planned} casos.
        </Alert>
      ) : null}
      {fakers ? <Alert tone={fakers.tone}>{fakers.text}</Alert> : null}

      <Panel
        title="Contraejemplos: los casos que fallaron, reducidos"
        meta={`semilla ${display(run, 'seed')}`}
      >
        <p className="field-hint">
          Un contraejemplo es un caso que incumple alguna comprobación, recortado a lo mínimo que
          sigue fallando. Las comprobaciones son técnicas —el contrato se impone, la salida está
          completa y con sus tipos, no se filtran datos internos ni sensibles y, si lo pides, el
          resultado se repite—; no juzgan si la decisión es buena para el negocio: eso lo dicen las
          suites de prueba con su resultado esperado.
        </p>
        <div data-tutorial-id="qa-lab-counterexamples">
          <QaCounterexampleList counterexamples={asRows(run.counterexamples)} />
        </div>
        <div className="panel-actions">
          <button type="button" className="button" disabled={active} onClick={onReproduce}>
            <RotateCcw size={14} aria-hidden /> Reproducir esta corrida
          </button>
        </div>
        <details className="qa-technical">
          <summary>Detalle técnico</summary>
          <p className="field-hint">
            Corrida {display(run, 'id')} · versión {display(run, 'artifactVersionId')} · generador{' '}
            {display(run, 'generatorVersion')}
            {tooling.fakers ? ` · generador de datos realistas ${String(tooling.fakers)}` : ''}
          </p>
        </details>
      </Panel>
    </>
  );
}
