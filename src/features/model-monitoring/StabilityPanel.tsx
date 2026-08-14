'use client';

import { AlertTriangle } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { asPercent } from './useModelMonitoring';

/**
 * Estabilidad poblacional: ¿le siguen llegando los mismos solicitantes?
 *
 * Es la pregunta que detecta la erosión, que es como se rompen las políticas de crédito a largo
 * plazo: no de golpe, sino porque cambia el mix de canales, entra un producto nuevo o migra un
 * proveedor de datos, y el corte que era bueno deja de serlo sin que nada dé error.
 *
 * Las bandas van ordenadas por aportación al índice: la primera es la que explica el
 * desplazamiento, y es la que hay que mirar antes de tocar ningún umbral.
 */
export function StabilityPanel({ report }: { report: UnknownRecord }) {
  const data = asRecord(report);
  const buckets = asRows(data.buckets);
  const psi = Number(data.psi ?? 0);
  const verdict = String(data.verdict ?? '');

  return (
    <Panel
      title="Estabilidad poblacional"
      meta={`variable ${String(data.variableCode ?? '—')}`}
      tutorialId="monitoring-stability"
    >
      <div className="monitoring-headline">
        <div>
          <span className="monitoring-headline-label">Índice de estabilidad (PSI)</span>
          <strong className="monitoring-headline-value">{psi.toFixed(3)}</strong>
        </div>
        <StatusBadge value={verdict} />
      </div>

      <p className="monitoring-note">
        Cortes de uso corriente: por debajo de 0,10 la población es estable; hasta 0,25 se ha
        desplazado; por encima, es otra población. Referencia{' '}
        {Number(data.referenceCount ?? 0).toLocaleString('es-BO')} decisiones · ventana actual{' '}
        {Number(data.currentCount ?? 0).toLocaleString('es-BO')}.
      </p>

      {buckets.length ? (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Banda</th>
              <th scope="col">Peso en la referencia</th>
              <th scope="col">Peso ahora</th>
              <th scope="col">Aportación al índice</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket, index) => (
              <tr key={`${display(bucket, 'bucket')}-${index}`}>
                <td>
                  <code>{display(bucket, 'bucket')}</code>
                </td>
                <td>{asPercent(bucket.referenceShare)}</td>
                <td>{asPercent(bucket.currentShare)}</td>
                <td>{Number(bucket.contribution ?? 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="monitoring-note monitoring-note-warning">
          <AlertTriangle size={14} aria-hidden />
          <span>
            No hay bandas comparables entre las dos ventanas. Con una referencia vacía el índice no
            mide un desplazamiento: mide que no hay con qué comparar.
          </span>
        </p>
      )}
    </Panel>
  );
}
