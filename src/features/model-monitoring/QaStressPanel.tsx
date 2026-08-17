'use client';

import { AlertTriangle, FlaskConical, Gauge, TrendingUp, Zap } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { MetricCard } from '../../components/MetricCard';
import { Panel } from '../../components/Panel';
import { formatDateTime } from '../../config/locale';
import { runStatusLabel } from '../qa-lab/qa-run-status';
import { asMs, asThroughput, type StressSeries } from './qa-stress';
import { asPercent } from './useModelMonitoring';

/**
 * Sincronización con el QA Lab: qué aguantó esta versión cuando se la sometió a estrés.
 *
 * Va en esta pantalla porque responde una pregunta que las otras tres no pueden: el desempeño
 * observado necesita desenlaces reales del libro de préstamos, y una versión recién desplegada
 * —justo cuando más importa saber si aguanta— todavía no tiene ninguno. Entre el despliegue y
 * la primera cosecha madura hay meses en los que el tablero está vacío; la serie de estrés es
 * lo único medible en esa ventana.
 *
 * **Y es un carril APARTE, no una fila más.** Las corridas del QA Lab no persisten ejecuciones
 * —`observe()` no escribe nada— y eso es deliberado: miles de decisiones sintéticas dentro de
 * `decision_execution` diluirían los ratios de cobertura y contaminarían las tablas sobre las
 * que se responde a un regulador. Así que aquí no se mezcla ni un número con los de arriba, y
 * el panel lo dice en pantalla en vez de confiar en que se sepa.
 */
export function QaStressPanel({
  series,
  versionId,
  isError,
}: {
  series: StressSeries;
  versionId: string;
  isError: boolean;
}) {
  const { runs, measured, totalCases, totalFailed, failureRate, degradation } = series;

  return (
    <Panel
      title="Sincronización con QA Lab"
      meta={`versión ${versionId} · ${runs.length} corridas archivadas`}
      tutorialId="monitoring-qa-stress"
    >
      <p className="monitoring-note monitoring-note-synthetic">
        <FlaskConical size={14} aria-hidden />
        <span>
          Carga <b>sintética</b>: casos que el generador derivó del contrato, no decisiones de
          personas. <b>No entra en ninguna tasa de esta pantalla</b> —ni suma al denominador de la
          cobertura— porque el QA Lab no persiste ejecuciones. Mide si el motor <i>aguanta</i>, no
          si el modelo <i>acierta</i>.
        </span>
      </p>

      {isError ? (
        <p className="monitoring-note monitoring-note-warning">
          <AlertTriangle size={14} aria-hidden />
          <span>
            No se pudieron leer las corridas de QA de esta versión. Lo que falta es el historial, no
            las corridas: lo que se haya ejecutado sigue archivado en el QA Lab.
          </span>
        </p>
      ) : null}

      {runs.length === 0 ? (
        <EmptyState
          illustration="tests"
          title="Esta versión no se ha sometido a estrés"
          description="Ninguna corrida del QA Lab apunta a esta versión. Sin una serie de carga no hay nada que decir sobre cuánto aguanta: lanza dos o tres corridas de tamaño creciente, con la MISMA concurrencia, y vuelve aquí."
          example="300 · 1500 · 4000 casos, concurrencia 1"
        />
      ) : (
        <>
          <div className="metric-grid">
            <MetricCard
              label="Corridas con casos"
              value={`${measured} de ${runs.length}`}
              hint="Las demás se cortaron o siguen en marcha: no miden nada todavía."
              icon={FlaskConical}
            />
            <MetricCard
              label="Casos ejecutados"
              value={totalCases.toLocaleString('es-BO')}
              hint="Decisiones sintéticas que el motor resolvió en estas corridas."
              icon={Zap}
            />
            <MetricCard
              label="Propiedades violadas"
              value={failureRate === null ? '—' : asPercent(failureRate)}
              hint={
                failureRate === null
                  ? 'Ni un caso ejecutado: no hay denominador.'
                  : `${totalFailed.toLocaleString('es-BO')} de ${totalCases.toLocaleString('es-BO')} casos.`
              }
              icon={AlertTriangle}
              tone={failureRate !== null && failureRate > 0 ? 'danger' : 'default'}
            />
            <MetricCard
              label="Coste por caso bajo carga"
              value={degradation === null ? '—' : `×${degradation.factor.toFixed(2)}`}
              hint={
                degradation === null
                  ? 'Hacen falta dos corridas de distinto tamaño y misma configuración.'
                  : `${asMs(degradation.lightest.msPerCase)} con ${degradation.lightest.cases} casos → ${asMs(degradation.heaviest.msPerCase)} con ${degradation.heaviest.cases}, a concurrencia ${degradation.lightest.concurrency}${degradation.lightest.checkDeterminism ? ' con determinismo' : ''}.`
              }
              icon={degradation !== null && degradation.factor > 1 ? TrendingUp : Gauge}
              tone={degradation !== null && degradation.factor >= 2 ? 'warning' : 'default'}
            />
          </div>

          {degradation === null && measured >= 2 ? (
            <p className="monitoring-note">
              Ninguna configuración reúne dos corridas de distinto tamaño: cambian de concurrencia,
              de comprobación de determinismo, o no la archivaron. El milisegundo por caso de cada
              una es correcto, pero dividir una entre otra mediría la configuración y no el motor,
              así que no se hace.
            </p>
          ) : degradation !== null && degradation.cohort < measured ? (
            <p className="monitoring-note">
              El factor se midió sobre las {degradation.cohort} corridas que comparten
              configuración, no sobre las {measured} de la tabla: las demás corrieron con otra carga
              y meterlas en la misma cuenta mediría la configuración y no el motor.
            </p>
          ) : null}

          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Inicio</th>
                <th scope="col">Estado</th>
                <th scope="col">Ambiente</th>
                <th scope="col">Casos</th>
                <th scope="col">Concurrencia</th>
                <th scope="col">ms / caso</th>
                <th scope="col">Caudal</th>
                <th scope="col">Violaciones</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className={run.failed > 0 ? 'row-flagged' : undefined}>
                  <td>{formatDateTime(run.startedAt)}</td>
                  <td>{runStatusLabel(run.status)}</td>
                  <td>{run.environmentCode}</td>
                  <td>{run.cases.toLocaleString('es-BO')}</td>
                  <td>
                    {run.concurrency === null ? '—' : run.concurrency}
                    {run.checkDeterminism ? ' · ×2 determinismo' : ''}
                  </td>
                  <td>{asMs(run.msPerCase)}</td>
                  <td>{asThroughput(run.casesPerSecond)}</td>
                  <td>
                    {run.failed}{' '}
                    {run.counterexamples > 0 ? `(${run.counterexamples} guardados)` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="monitoring-note">
            La concurrencia y el determinismo se enseñan porque sin ellos el <b>ms / caso</b> no se
            puede comparar: con concurrencia 1 el motor despacha de uno en uno, y con la
            comprobación de determinismo activa cada caso se ejecuta <b>dos veces</b>. Una corrida
            sin ese dato archivado sale como «—» en vez de suponerle el valor de serie.
          </p>
        </>
      )}
    </Panel>
  );
}
