'use client';

import { useState } from 'react';
import { FileCheck2, Gauge, ScanFace, ShieldCheck, TrendingUp } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Tabs, type TabDefinition } from '../components/Tabs';
import { CalibrationPanel } from '../features/risk-governance/CalibrationPanel';
import { ConsentPanel } from '../features/risk-governance/ConsentPanel';
import { ModelDossierPanel } from '../features/risk-governance/ModelDossierPanel';
import { PortfolioAppetitePanel } from '../features/risk-governance/PortfolioAppetitePanel';
import { ReidentificationPanel } from '../features/risk-governance/ReidentificationPanel';

const TABS: readonly TabDefinition[] = [
  {
    id: 'apetito',
    label: 'Apetito',
    icon: Gauge,
    hint: 'Cuánto queda antes de topar: exposición, concentración y presupuesto.',
    tutorialId: 'risk-tab-appetite',
  },
  {
    id: 'calibracion',
    label: 'Calibración',
    icon: TrendingUp,
    hint: '¿La probabilidad que publica el modelo es la que ocurre?',
    tutorialId: 'risk-tab-calibration',
  },
  {
    id: 'permisos',
    label: 'Permisos',
    icon: ShieldCheck,
    hint: 'Qué datos de esta persona se pueden tratar hoy, y hasta cuándo.',
    tutorialId: 'risk-tab-consent',
  },
  {
    id: 'reidentificacion',
    label: 'Reidentificación',
    icon: ScanFace,
    hint: 'Ir del caso seudónimo a la persona: dos firmas y por escrito.',
    tutorialId: 'risk-tab-reidentification',
  },
  {
    id: 'expediente',
    label: 'Expediente',
    icon: FileCheck2,
    hint: 'Quién validó cada versión, con qué límites y cuándo toca revisarla.',
    tutorialId: 'risk-tab-dossier',
  },
];

/**
 * Gobierno del riesgo: las condiciones bajo las que se deja decidir al motor.
 *
 * Ninguna de las cinco pestañas decide nada; todas condicionan lo que se puede decidir. Es la
 * diferencia con «Calidad de la decisión», que mide si el circuito funciona, y con «Monitoreo del
 * Modelo», que mide si el modelo se degrada.
 *
 * Están juntas porque comparten una propiedad incómoda: son las que se saltan cuando hay prisa.
 * Un límite de cartera que vive dentro de una regla del grafo desaparece al clonar el artefacto;
 * una validación sin fecha de caducidad se vuelve un papel viejo; un permiso sin vigencia deja de
 * ser un permiso. Reunirlas en una pantalla es lo que hace que se noten cuando faltan.
 */
export function RiskGovernancePage() {
  const [tab, setTab] = useState('apetito');

  return (
    <div className="page">
      <PageHeader
        eyebrow="Gobierno"
        title="Gobierno del riesgo"
        description="Apetito de cartera, calibración, licitud vigente, reidentificación y expediente del modelo."
        hint="Lo que condiciona una decisión sin tomarla: cuánto queda, si la probabilidad es fiable, qué datos se pueden usar y quién validó el modelo."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} idPrefix="risk-governance">
        {(activeId) => {
          if (activeId === 'apetito') return <PortfolioAppetitePanel />;
          if (activeId === 'calibracion') return <CalibrationPanel />;
          if (activeId === 'permisos') return <ConsentPanel />;
          if (activeId === 'reidentificacion') return <ReidentificationPanel />;
          return <ModelDossierPanel />;
        }}
      </Tabs>
    </div>
  );
}
