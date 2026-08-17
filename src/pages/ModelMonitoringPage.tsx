'use client';

import { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { AdverseImpactPanel } from '../features/model-monitoring/AdverseImpactPanel';
import {
  MonitoringControls,
  type MonitoringForm,
} from '../features/model-monitoring/MonitoringControls';
import { PerformancePanel } from '../features/model-monitoring/PerformancePanel';
import { QaStressPanel } from '../features/model-monitoring/QaStressPanel';
import { StabilityPanel } from '../features/model-monitoring/StabilityPanel';
import {
  useAdverseImpactReport,
  usePerformanceReport,
  useStabilityReport,
} from '../features/model-monitoring/useModelMonitoring';
import { useQaStressRuns } from '../features/model-monitoring/useQaStressRuns';
import { asRecord } from '../utils/records';

const EMPTY_FORM: MonitoringForm = {
  versionId: '',
  from: '',
  to: '',
  variableCode: '',
  referenceFrom: '',
  referenceTo: '',
  attribute: '',
};

/** Una fecha de formulario a instante ISO. Vacía = sin límite, que el motor acepta. */
function toIso(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined;
  return `${date}T${endOfDay ? '23:59:59.000' : '00:00:00.000'}Z`;
}

/**
 * Monitoreo continuo del modelo desplegado (SR 11-7 §V; CMN 4.557 art. 40).
 *
 * El motor calculaba estas tres medidas desde hacía tiempo y no había ninguna pantalla que las
 * pidiera. Quien tiene que vigilar la degradación —Riesgo, Cumplimiento— no podía verla, así que
 * una política que se erosiona lo hacía sin testigos.
 *
 * Las tres van juntas porque responden preguntas distintas y sólo se entienden en conjunto: si el
 * modelo sigue acertando, si le siguen llegando los mismos solicitantes, y si trata igual a grupos
 * comparables. Un acierto estable sobre una población que cambió no es un buen modelo: es uno al
 * que todavía no le ha tocado.
 */
export function ModelMonitoringPage() {
  const [form, setForm] = useState<MonitoringForm>(EMPTY_FORM);
  const performance = usePerformanceReport();
  const stability = useStabilityReport();
  const adverseImpact = useAdverseImpactReport();
  // La serie de estrés se sincroniza con la versión ELEGIDA, no con la medida: se ve al
  // instante de escogerla, sin pulsar «Medir». Es lo único medible de una versión recién
  // desplegada, que todavía no tiene ni un desenlace con el que calcular las tres de abajo.
  const stress = useQaStressRuns(form.versionId);

  const running = performance.isPending || stability.isPending || adverseImpact.isPending;

  function run() {
    const window = {
      artifactVersionId: form.versionId,
      from: toIso(form.from),
      to: toIso(form.to, true),
    };
    performance.mutate(window);
    // Estabilidad e impacto adverso sólo se piden si su parámetro está: lanzarlas vacías devolvería
    // un error del motor que se lee como «falla la pantalla» y no como «falta un dato».
    if (form.variableCode && form.referenceFrom && form.referenceTo) {
      stability.mutate({
        ...window,
        variableCode: form.variableCode,
        referenceFrom: toIso(form.referenceFrom) ?? '',
        referenceTo: toIso(form.referenceTo, true) ?? '',
      });
    }
    if (form.attribute) adverseImpact.mutate({ ...window, attribute: form.attribute });
  }

  const nothingRun = !performance.data && !stability.data && !adverseImpact.data;

  return (
    <>
      <PageHeader
        eyebrow="Auditoría"
        title="Monitoreo del modelo"
        description="Desempeño real, estabilidad de la población e impacto adverso de una versión desplegada."
        hint="Las tasas salen de desenlaces observados que el libro de préstamos entrega por cosecha. Una versión recién desplegada todavía no tiene ninguno: sus números estarán vacíos hasta que maduren las ventanas."
      />

      <Panel title="Qué medir" tutorialId="monitoring-controls">
        <MonitoringControls
          form={form}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onRun={run}
          running={running}
        />
      </Panel>

      {performance.data ? <PerformancePanel report={asRecord(performance.data)} /> : null}
      {stability.data ? <StabilityPanel report={asRecord(stability.data)} /> : null}
      {adverseImpact.data ? <AdverseImpactPanel report={asRecord(adverseImpact.data)} /> : null}

      {form.versionId ? (
        <QaStressPanel series={stress.series} versionId={form.versionId} isError={stress.isError} />
      ) : null}

      {nothingRun ? (
        <EmptyState
          illustration="empty"
          title="Elige una versión y mide"
          description="El desempeño se calcula siempre. La estabilidad necesita además una variable y su ventana de referencia; el impacto adverso, un atributo ya agrupado en bandas."
          example="ingresos_mensuales · AGE_BAND"
        />
      ) : null}
    </>
  );
}
