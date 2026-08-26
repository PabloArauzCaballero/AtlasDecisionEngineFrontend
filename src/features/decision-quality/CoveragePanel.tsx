'use client';

import { AlertTriangle, CircleSlash, Fingerprint, Target } from 'lucide-react';
import { MetricCard } from '../../components/MetricCard';
import { Panel } from '../../components/Panel';
import { asPercent, coverageTone, type CoverageReport } from './decision-quality.api';

interface CoveragePanelProps {
  report: CoverageReport;
}

/**
 * ¿Está vivo el circuito de la decisión?
 *
 * Los dos indicadores llegan siempre con su DENOMINADOR a la vista. Un 100 % sobre tres
 * decisiones y un 100 % sobre veinte mil se pintan idénticos si sólo se enseña el porcentaje, y
 * el primero no es una noticia: es una semana sin operación. Por eso debajo de cada cifra va la
 * fracción entera, y por eso una cobertura que no se pudo medir sale como «—» y en tono neutro
 * en vez de como 0 % en rojo.
 */
export function CoveragePanel({ report }: CoveragePanelProps) {
  const { subject, outcome, seeded } = report;
  /*
   * El aviso aparece con UNA sola decisión sembrada, no a partir de un umbral.
   *
   * Un umbral («avisar si pasa del 20 %») obliga a elegir un número que nadie puede defender, y
   * el caso que de verdad engaña no es el 80 %: es el 15 % de siembra dentro de una población
   * pequeña, donde un puñado de casos inventados mueve la tasa de malos y nada lo dice. Cuando
   * la proporción es baja, el propio aviso la enseña y quien lee decide.
   */
  const seededCount = seeded?.executions ?? 0;
  return (
    <Panel
      title="Cobertura del circuito"
      meta={`${new Date(report.from).toLocaleDateString()} – ${new Date(report.to).toLocaleDateString()}`}
      tutorialId="quality-coverage"
    >
      {seededCount > 0 && (
        <p className="quality-seeded">
          <strong>
            {seededCount} de {subject.executions} decisiones de esta ventana son siembra de
            demostración
          </strong>{' '}
          ({asPercent(seeded?.share ?? null)}). Los indicadores de abajo, y los del monitoreo del
          modelo, se calculan bien sobre una población inventada: son ejercicios, no evidencia. En
          una base sembrada sin datos de demostración este aviso no aparece.
        </p>
      )}

      <div className="metric-grid">
        <MetricCard
          label="Decisiones con solicitante"
          value={asPercent(subject.coverageRatio)}
          hint={`${subject.withSubject} de ${subject.eligible} que deberían llevarlo`}
          icon={Fingerprint}
          tone={coverageTone(subject.coverageRatio)}
        />
        <MetricCard
          label="Ventanas vencidas observadas"
          value={asPercent(outcome.coverageRatio)}
          hint={`${outcome.observedWindows} de ${outcome.dueWindows} ya vencidas`}
          icon={Target}
          tone={coverageTone(outcome.coverageRatio)}
        />
        <MetricCard
          label="Decisiones sin solicitante"
          value={String(subject.missing)}
          hint="Irreparables: la referencia se guarda en HMAC de una vía"
          icon={AlertTriangle}
          tone={subject.missing > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          label="Declaran no tener sujeto"
          value={String(subject.notApplicable)}
          hint="Fuera del denominador, no restadas del acierto"
          icon={CircleSlash}
          tone="default"
        />
      </div>

      {outcome.inferredWindows > 0 && (
        <p className="quality-note">
          {outcome.inferredWindows} de las {outcome.observedWindows} observaciones fueron{' '}
          <strong>inferidas</strong>, no observadas. Mezclarlas con las observadas calibra el modelo
          contra la población que ya se aprobó y lo hace parecer mejor de lo que es.
        </p>
      )}

      <CoverageSeries daily={report.daily} />
    </Panel>
  );
}

/**
 * Serie diaria de decisiones y de cuántas llevaron solicitante.
 *
 * Barras y no una línea de porcentaje: la altura dice el VOLUMEN, que es la mitad de la
 * información. Un día con dos decisiones y las dos identificadas no debe verse igual de sólido
 * que uno con seiscientas.
 */
function CoverageSeries({ daily }: { daily: CoverageReport['daily'] }) {
  if (!daily.length) return null;
  const peak = Math.max(...daily.map((day) => day.executions), 1);

  return (
    <figure className="coverage-series">
      <figcaption>
        Decisiones por día. La parte llena es la que identificó al solicitante.
      </figcaption>
      <div className="coverage-series-track" role="img" aria-label={seriesSummary(daily)}>
        {daily.map((day) => (
          <div
            className="coverage-day"
            key={day.day}
            style={{ height: `${Math.max(4, (day.executions / peak) * 100)}%` }}
            title={`${day.day}: ${day.withSubject} de ${day.executions} con solicitante`}
          >
            <span
              className="coverage-day-covered"
              style={{
                height: day.executions ? `${(day.withSubject / day.executions) * 100}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>
    </figure>
  );
}

/** El mismo dato en una frase, para quien no ve la gráfica. */
function seriesSummary(daily: CoverageReport['daily']): string {
  const executions = daily.reduce((total, day) => total + day.executions, 0);
  const covered = daily.reduce((total, day) => total + day.withSubject, 0);
  return `${daily.length} días, ${executions} decisiones, ${covered} con solicitante identificado.`;
}
