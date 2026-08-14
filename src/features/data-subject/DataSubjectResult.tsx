'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate } from '../../config/locale';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * Resolución de una solicitud del titular.
 *
 * Lo que se enseña es lo que se le puede entregar a la persona: los motivos PÚBLICOS de cada
 * decisión, nunca los internos. Esa frontera la impone el motor y aquí no se cruza — mostrar un
 * mensaje interno en esta pantalla sería entregárselo, porque esta pantalla es de lo que se le lee
 * al titular por teléfono o se le exporta.
 */
export function DataSubjectResult({ result }: { result: UnknownRecord }) {
  const data = asRecord(result);
  const decisions = asRows(data.decisions);
  const resolution = asRecord(data.resolution);
  const truncated = resolution.truncated === true;

  return (
    <Panel title="Resolución" meta={`solicitud ${display(data, 'id')}`} tutorialId="dsr-result">
      <dl className="definition-grid">
        <div>
          <dt>Tipo</dt>
          <dd>{display(data, 'requestType')}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <StatusBadge value={display(data, 'status')} />
          </dd>
        </div>
        <div>
          <dt>Decisiones encontradas</dt>
          <dd>{Number(data.matchedDecisions ?? 0).toLocaleString('es-BO')}</dd>
        </div>
        <div>
          <dt>Registrada</dt>
          <dd>{formatDate(display(data, 'createdAt'))}</dd>
        </div>
      </dl>

      {display(resolution, 'scope') !== '—' ? (
        <p className="dsr-note">
          <Info size={14} aria-hidden />
          <span>
            <b>Alcance:</b> {display(resolution, 'scope')}
          </span>
        </p>
      ) : null}

      {truncated ? (
        <p className="dsr-note dsr-note-warning">
          <AlertTriangle size={14} aria-hidden />
          <span>
            La entrega llegó al techo por respuesta: <b>esto no es el historial completo</b>. Repite
            la consulta acotando el periodo antes de dar por entregado el derecho de acceso.
          </span>
        </p>
      ) : null}

      {decisions.length ? (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Ejecución</th>
              <th scope="col">Fecha</th>
              <th scope="col">Artefacto</th>
              <th scope="col">Desenlace</th>
              <th scope="col">Motivos comunicables</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((decision) => (
              <tr key={display(decision, 'executionId')}>
                <td>
                  <code>{display(decision, 'executionId')}</code>
                </td>
                <td>{formatDate(display(decision, 'executedAt'))}</td>
                <td>
                  {display(decision, 'artifactName')}{' '}
                  <small>v{display(decision, 'versionNumber')}</small>
                </td>
                <td>
                  <StatusBadge value={display(decision, 'outcome')} />
                </td>
                <td>
                  <ul className="dsr-reasons">
                    {asRows(decision.reasons).map((reason, index) => (
                      <li key={`${display(reason, 'code')}-${index}`}>
                        {display(reason, 'message')}
                        {reason.adverseAction === true ? <b> · acción adversa</b> : null}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="dsr-note">
          <Info size={14} aria-hidden />
          <span>
            Esta solicitud no devuelve decisiones. Una eliminación responde con su alcance, no con
            el contenido que no va a borrar; una revisión humana abre el caso, no lo resuelve aquí.
          </span>
        </p>
      )}
    </Panel>
  );
}
