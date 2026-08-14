'use client';

import { useState } from 'react';
import { Fingerprint, Inbox, LineChart, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { Tabs, type TabDefinition } from '../components/Tabs';
import { CoveragePanel } from '../features/decision-quality/CoveragePanel';
import { CutoffPanel } from '../features/decision-quality/CutoffPanel';
import { FacilityRegistrationPanel } from '../features/decision-quality/FacilityRegistrationPanel';
import { OutcomeUploadPanel } from '../features/decision-quality/OutcomeUploadPanel';
import { PendingWindowsPanel } from '../features/decision-quality/PendingWindowsPanel';
import { VintageMatrix } from '../features/decision-quality/VintageMatrix';
import { useCoverageReport } from '../features/decision-quality/decision-quality.api';

const TABS: readonly TabDefinition[] = [
  {
    id: 'cobertura',
    label: 'Cobertura',
    icon: Fingerprint,
    hint: '¿El motor sabe a quién decidió y si alguien observó el resultado?',
    tutorialId: 'quality-tab-coverage',
  },
  {
    id: 'desenlaces',
    label: 'Desenlaces',
    icon: Inbox,
    hint: 'Ventanas vencidas sin observar, carga en lote y alta de créditos.',
    tutorialId: 'quality-tab-outcomes',
  },
  {
    id: 'corte',
    label: 'Punto de corte',
    icon: SlidersHorizontal,
    hint: 'Qué se aprobaría con cada umbral, y champion contra challenger por desenlace.',
    tutorialId: 'quality-tab-cutoff',
  },
  {
    id: 'cosechas',
    label: 'Cosechas',
    icon: LineChart,
    hint: 'Tasa de malos por mes de decisión y madurez del crédito.',
    tutorialId: 'quality-tab-vintages',
  },
];

/** Ventanas de medición. Días, no meses: la cobertura es una alarma, no un informe. */
const WINDOWS = [7, 30, 90] as const;

/**
 * Calidad de la decisión: ¿el sistema sabe a quién decidió y si acertó?
 *
 * Es la pantalla que faltaba, y su ausencia ERA el problema. El motor tenía desde hacía meses la
 * tabla de desenlaces observados, los atributos para medir sesgo y los tres análisis de
 * degradación, y no había una sola vista que los pidiera. Una capacidad invisible no se usa, y
 * una que no se usa se rompe sin que nadie lo note, porque ninguna prueba de extremo a extremo
 * pasa por ahí.
 *
 * Tres pestañas porque son tres preguntas con tres ritmos: la cobertura se mira a diario y es
 * una alarma; los desenlaces son trabajo por hacer; las cosechas se leen una vez al mes y son
 * una conclusión.
 */
export function DecisionQualityPage() {
  const [tab, setTab] = useState('cobertura');

  return (
    <div className="page">
      <PageHeader
        eyebrow="Auditoría"
        title="Calidad de la decisión"
        description="Si el motor no sabe a quién decidió ni si acertó, ninguna otra medida significa nada."
        hint="Mide el sistema de medición: cuántas decisiones identifican al solicitante y cuántas ventanas de observación vencidas cerró alguien."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} idPrefix="decision-quality">
        {(activeId) => {
          if (activeId === 'cobertura') return <CoverageTab />;
          if (activeId === 'desenlaces') return <OutcomesTab />;
          if (activeId === 'corte') return <CutoffPanel />;
          return <VintageTab />;
        }}
      </Tabs>
    </div>
  );
}

function CoverageTab() {
  const [days, setDays] = useState<number>(30);
  const coverage = useCoverageReport(days);

  return (
    <div className="quality-stack">
      <div className="quality-range" role="group" aria-label="Ventana de medición">
        {WINDOWS.map((option) => (
          <button
            key={option}
            type="button"
            className={`button ${days === option ? 'primary' : ''}`.trim()}
            aria-pressed={days === option}
            onClick={() => setDays(option)}
          >
            {option} días
          </button>
        ))}
      </div>
      {coverage.data ? (
        <CoveragePanel report={coverage.data} />
      ) : (
        <Panel
          title="Cobertura del circuito"
          meta={coverage.isLoading ? 'Cargando…' : 'Sin medición'}
        >
          <p className="quality-muted">
            {coverage.isLoading
              ? 'Midiendo el circuito…'
              : 'El motor no devolvió medición para esta ventana.'}
          </p>
        </Panel>
      )}
    </div>
  );
}

function OutcomesTab() {
  return (
    <div className="quality-stack">
      <PendingWindowsPanel />
      <OutcomeUploadPanel />
      <FacilityRegistrationPanel />
    </div>
  );
}

function VintageTab() {
  const [versionId, setVersionId] = useState('');
  return (
    <div className="quality-stack">
      <label className="field quality-filter">
        <span>Versión del algoritmo (vacío = todas)</span>
        <input
          value={versionId}
          onChange={(event) => setVersionId(event.target.value)}
          placeholder="4001"
        />
      </label>
      <VintageMatrix artifactVersionId={versionId.trim()} />
    </div>
  );
}
