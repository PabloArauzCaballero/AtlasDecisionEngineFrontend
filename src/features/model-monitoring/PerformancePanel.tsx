'use client';

import { AlertTriangle, CheckCircle2, ScanLine, ShieldAlert, TrendingDown } from 'lucide-react';
import { MetricCard } from '../../components/MetricCard';
import { Panel } from '../../components/Panel';
import { asRecord, type UnknownRecord } from '../../utils/records';
import { asPercent } from './useModelMonitoring';

/**
 * Desempeño observado: ¿la versión desplegada sigue acertando?
 *
 * El número que casi nadie mira y que más dice es `falseDeclineRate` — los rechazados que se
 * habrían comportado bien. Es lo único que detecta un modelo que se ha vuelto demasiado
 * restrictivo, porque sus malos no aparecen en ninguna estadística: nunca llegaron a entrar.
 */
export function PerformancePanel({ report }: { report: UnknownRecord }) {
  const data = asRecord(report);
  const observed = Number(data.observed ?? 0);
  const conclusive = Number(data.conclusive ?? 0);
  const pending = Math.max(0, observed - conclusive);

  return (
    <Panel
      title="Desempeño observado"
      meta={`versión ${String(data.artifactVersionId ?? '—')}`}
      tutorialId="monitoring-performance"
    >
      <div className="metric-grid">
        <MetricCard
          label="Tasa de malos"
          value={asPercent(data.badRate)}
          hint="Aprobados que salieron mal, sobre los aprobados con desenlace conocido."
          icon={TrendingDown}
          tone={typeof data.badRate === 'number' && data.badRate > 0.1 ? 'danger' : 'default'}
        />
        <MetricCard
          label="Falsos rechazos"
          value={asPercent(data.falseDeclineRate)}
          hint="Rechazados que se habrían comportado bien. Detecta un modelo demasiado restrictivo."
          icon={ShieldAlert}
          tone={
            typeof data.falseDeclineRate === 'number' && data.falseDeclineRate > 0.15
              ? 'warning'
              : 'default'
          }
        />
        <MetricCard
          label="Tasa de buenos"
          value={asPercent(data.goodRate)}
          hint="Aprobados que salieron bien."
          icon={CheckCircle2}
        />
        <MetricCard
          label="Separación"
          value={typeof data.discrimination === 'number' ? data.discrimination.toFixed(2) : '—'}
          hint="Distancia entre la puntuación media de buenos y malos, de 0 a 1. Léela como tendencia."
          icon={ScanLine}
        />
      </div>

      <dl className="definition-grid monitoring-counts">
        <div>
          <dt>Decisiones observadas</dt>
          <dd>{observed.toLocaleString('es-BO')}</dd>
        </div>
        <div>
          <dt>Con desenlace conocido</dt>
          <dd>{conclusive.toLocaleString('es-BO')}</dd>
        </div>
        <div>
          <dt>Aprobadas</dt>
          <dd>{Number(data.approved ?? 0).toLocaleString('es-BO')}</dd>
        </div>
        <div>
          <dt>Rechazadas</dt>
          <dd>{Number(data.declined ?? 0).toLocaleString('es-BO')}</dd>
        </div>
      </dl>

      {pending > 0 ? (
        <p className="monitoring-note">
          <AlertTriangle size={14} aria-hidden />
          <span>
            {pending.toLocaleString('es-BO')} observaciones están en la zona gris (entre 30 y 89
            días de atraso) o todavía sin resolver. <b>No entran en ningún denominador</b>:
            contarlas como buenas inflaría el acierto de la versión sin que nada avisara.
          </span>
        </p>
      ) : null}

      {conclusive === 0 ? (
        <p className="monitoring-note monitoring-note-warning">
          <AlertTriangle size={14} aria-hidden />
          <span>
            Ninguna decisión de esta ventana tiene desenlace conocido todavía. Las tasas que se ven
            arriba no miden nada: hacen falta cosechas maduras que el libro de préstamos aún no ha
            entregado.
          </span>
        </p>
      ) : null}
    </Panel>
  );
}
