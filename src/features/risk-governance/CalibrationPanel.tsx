'use client';

import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { useComputeCalibration, type CalibrationReport } from './risk-governance.api';

/**
 * Curva de calibración: ¿el NIVEL de la probabilidad es correcto?
 *
 * Se confunde con la discriminación y no son lo mismo. Un modelo puede ordenar perfectamente —el
 * decil 10 siempre peor que el 1— y estar descalibrado por un factor de tres. Mientras la decisión
 * sea sí/no con un corte, da igual; en cuanto la PD entra en el precio, el error se vuelve dinero,
 * y encima dinero que cuadra: los informes salen bien, sólo que describen otra cartera.
 *
 * Por eso el gráfico enfrenta predicho contra observado decil a decil en vez de enseñar sólo el
 * estadístico: el Hosmer-Lemeshow dice que el ajuste es malo y no DÓNDE. Equivocarse en la cola de
 * riesgo alto cuesta pérdidas; en la de riesgo bajo, negocio. Dos problemas, dos remedios.
 */
export function CalibrationPanel() {
  const [form, setForm] = useState({
    artifactVersionId: '',
    windowDays: '90',
    predictionField: 'pd',
  });
  const compute = useComputeCalibration();
  const report = compute.data;

  const submit = () =>
    compute.mutate({
      artifactVersionId: form.artifactVersionId.trim(),
      windowDays: Number.parseInt(form.windowDays, 10),
      predictionField: form.predictionField.trim(),
    });

  return (
    <div className="quality-stack">
      <Panel
        title="Calibrar una versión"
        meta="sólo con desenlaces observados, nunca inferidos"
        tutorialId="risk-calibration"
      >
        <div className="quality-form-grid">
          <label className="field">
            <span>Versión del algoritmo</span>
            <input
              value={form.artifactVersionId}
              placeholder="4001"
              onChange={(event) => setForm({ ...form, artifactVersionId: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Ventana (días)</span>
            <input
              value={form.windowDays}
              inputMode="numeric"
              onChange={(event) => setForm({ ...form, windowDays: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Campo con la probabilidad</span>
            <input
              value={form.predictionField}
              onChange={(event) => setForm({ ...form, predictionField: event.target.value })}
            />
          </label>
        </div>
        <p className="quality-note">
          La calibración a 30 días y a 360 no son la misma curva, y mezclarlas es el error clásico:
          la mora madura con el tiempo, así que un modelo «pesimista» a 30 días puede estar bien
          calibrado a 360.
        </p>
        <div className="quality-inline-actions">
          <button
            type="button"
            className="button primary"
            disabled={!form.artifactVersionId.trim() || compute.isPending}
            onClick={submit}
          >
            {compute.isPending ? 'Calculando…' : 'Calcular curva'}
          </button>
        </div>
      </Panel>

      {report && <CurveView report={report} />}
    </div>
  );
}

function CurveView({ report }: { report: CalibrationReport }) {
  if (!report.buckets.length) {
    return (
      <Panel title="Curva de calibración" meta={`${report.analyzed} casos`}>
        <p className="quality-muted">
          Hacen falta al menos diez casos con predicción y desenlace observado. Con menos, una curva
          de diez puntos sobre cuatro créditos sería un dibujo, no una medición.
        </p>
      </Panel>
    );
  }

  const peak = Math.max(
    ...report.buckets.flatMap((bucket) => [bucket.predictedRate, bucket.observedRate]),
    0.01,
  );

  return (
    <Panel
      title="Curva de calibración"
      meta={`${report.analyzed} casos · ${report.windowDays} días`}
    >
      <div className="calibration-summary">
        <span>
          Hosmer-Lemeshow <strong>{report.hosmerLemeshow?.toFixed(1) ?? '—'}</strong>
        </span>
        <span>
          Sesgo medio{' '}
          <strong>{report.meanBias === null ? '—' : formatBias(report.meanBias)}</strong>
        </span>
      </div>
      <p className="quality-note">
        {report.meanBias === null
          ? 'Sin sesgo medible.'
          : report.meanBias > 0.01
            ? 'El modelo es PESIMISTA: predice más incumplimiento del que ocurre. Rechaza negocio bueno.'
            : report.meanBias < -0.01
              ? 'El modelo es OPTIMISTA: predice menos incumplimiento del que ocurre. La pérdida esperada que publique está corta.'
              : 'El nivel está bien ajustado: lo que predice es lo que ocurre.'}
      </p>

      <table className="data-table calibration-table">
        <thead>
          <tr>
            <th scope="col">Decil</th>
            <th scope="col">Predicho</th>
            <th scope="col">Observado</th>
            <th scope="col">Casos</th>
            <th scope="col">Comparación</th>
          </tr>
        </thead>
        <tbody>
          {report.buckets.map((bucket) => (
            <tr key={bucket.decile}>
              <th scope="row">{bucket.decile}</th>
              <td>{(bucket.predictedRate * 100).toFixed(1)} %</td>
              <td>{(bucket.observedRate * 100).toFixed(1)} %</td>
              <td>{bucket.sampleSize}</td>
              <td className="calibration-bars">
                <span
                  className="calibration-bar calibration-predicted"
                  style={{ width: `${(bucket.predictedRate / peak) * 100}%` }}
                />
                <span
                  className="calibration-bar calibration-observed"
                  style={{ width: `${(bucket.observedRate / peak) * 100}%` }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="quality-muted">
        Barra clara: predicho. Barra oscura: observado. Que la oscura sea más larga en los deciles
        altos significa que el modelo subestima justo donde se pierde el dinero.
      </p>
    </Panel>
  );
}

function formatBias(bias: number): string {
  const sign = bias > 0 ? '+' : '';
  return `${sign}${(bias * 100).toFixed(1)} pp`;
}
