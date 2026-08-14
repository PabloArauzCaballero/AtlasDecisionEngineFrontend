'use client';

import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '../../api/ApiError';
import { Alert } from '../../components/Alert';
import { Panel } from '../../components/Panel';
import {
  fetchAuditMetrics,
  MOTIVOS,
  tonoVerificacion,
  verifyAuditChain,
} from './audit-integrity.api';

/**
 * La integridad de la cadena de auditoría, con pantalla.
 *
 * `GET /v1/audit/chain/verify` existía desde hacía meses y sólo se podía llamar por consola —que
 * es exactamente donde no mira quien audita—. Una cadena de hashes que nadie comprueba no es una
 * garantía: es una promesa, y las promesas no se presentan ante un regulador.
 *
 * Tres decisiones de presentación, todas de la misma familia que gobierna las pantallas de
 * medición:
 *
 * 1. **«No se pudo comprobar» no es «está mal».** `HASH_KEY_UNAVAILABLE` significa que falta el
 *    secreto con el que se firmó, no que el evento fuera manipulado. En rojo mandaría a
 *    investigar una manipulación que no ocurrió; en verde escondería que no se comprobó nada.
 *    Va en ámbar y lo dice con palabras.
 * 2. **Cero eventos es neutro.** Un tenant que aún no ha decidido nada tiene una cadena
 *    íntegra y vacía; pintarlo de verde sugiere que se verificó algo.
 * 3. **El recuento siempre a la vista.** «Cadena íntegra» sobre 12 eventos y sobre 1.280.000 se
 *    leen igual si sólo se manda el veredicto.
 */
export function AuditIntegrityPanel() {
  const verificacion = useQuery({
    queryKey: ['audit-chain-verify'],
    queryFn: ({ signal }) => verifyAuditChain(signal),
    // No se refresca sola: recorrer la cadena entera es caro en el motor y esto se consulta
    // cuando alguien decide comprobar, no de fondo mientras se navega.
    staleTime: Infinity,
    retry: false,
  });
  const metricas = useQuery({
    queryKey: ['audit-metrics'],
    queryFn: ({ signal }) => fetchAuditMetrics(signal),
    retry: false,
  });

  const datos = verificacion.data;
  const tono = datos ? tonoVerificacion(datos) : 'neutral';

  return (
    <Panel
      title="Integridad del registro"
      className="audit-integrity-panel"
      meta={
        datos
          ? `${datos.eventCount.toLocaleString('es-BO')} eventos recorridos`
          : verificacion.isLoading
            ? 'Comprobando…'
            : undefined
      }
    >
      <p>
        <button
          className="button"
          type="button"
          disabled={verificacion.isFetching}
          onClick={() => void verificacion.refetch()}
        >
          {verificacion.isFetching ? 'Comprobando…' : 'Comprobar ahora'}
        </button>
      </p>

      {verificacion.isError ? <Alert tone="error">{errorMessage(verificacion.error)}</Alert> : null}

      {datos ? (
        <div className="audit-integrity">
          <p className="audit-integrity-verdict">
            <span className={`status-badge status-${tono}`}>
              {tono === 'success'
                ? 'Cadena íntegra'
                : tono === 'neutral'
                  ? 'Sin eventos todavía'
                  : tono === 'warning'
                    ? 'No se pudo comprobar entera'
                    : 'Integridad comprometida'}
            </span>
          </p>

          {tono === 'neutral' ? (
            <p className="field-help">
              Este tenant aún no ha registrado ningún evento. La cadena está íntegra por vacía, que
              no es lo mismo que verificada.
            </p>
          ) : null}

          {datos.headHash ? (
            <p className="field-help">
              Último eslabón: <code className="mono">{datos.headHash.slice(0, 16)}…</code>
            </p>
          ) : null}

          {datos.invalid.length > 0 ? (
            <ul className="audit-integrity-issues">
              {datos.invalid.map((evento) => {
                const motivo = MOTIVOS[evento.reason];
                return (
                  <li key={evento.id}>
                    <strong>{motivo?.titulo ?? evento.reason}</strong>{' '}
                    <span className="mono">#{evento.id}</span>
                    <p className="field-help">{motivo?.explicacion ?? evento.reason}</p>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {metricas.data ? (
        <p className="field-help">
          {metricas.data.total.toLocaleString('es-BO')} decisiones registradas
          {metricas.data.statuses.length
            ? ` · ${metricas.data.statuses
                .map((fila) => `${fila.status}: ${fila.count.toLocaleString('es-BO')}`)
                .join(' · ')}`
            : ''}
        </p>
      ) : null}
    </Panel>
  );
}
