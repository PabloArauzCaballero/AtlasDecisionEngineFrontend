'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../config/locale';
import { StatementResultView } from './StatementResultView';
import { StatementReviewActions } from './StatementReviewActions';
import { fetchStatementReview } from './statement-review.api';
import {
  confidenceLabel,
  pendingLabel,
  REVIEW_PRIORITY_LABEL,
  REVIEW_REASON_LABEL,
  type StatementReviewItem,
} from './statement-review';

/**
 * Un caso de la cola: plegado para priorizar, desplegado para decidir.
 *
 * Lo que se ve sin abrir es lo que hace falta para elegir cuál mirar —cuánto
 * lleva esperando, qué clase de duda es y cuánta— y nada más. El detalle
 * completo, que incluye lo extraído, se pide al motor **sólo al abrir**: veinte
 * casos trayendo cada uno su extracto normalizado convierten cargar la pantalla
 * en descargar la cola entera.
 */
export function StatementReviewCase({ item }: { item: StatementReviewItem }) {
  const [abierto, setAbierto] = useState(false);

  const detalle = useQuery({
    queryKey: ['statement-review', item.requestId],
    queryFn: ({ signal }) => fetchStatementReview(item.requestId, signal),
    enabled: abierto,
  });

  return (
    <li className="revision-caso" data-prioridad={String(item.reviewPriority)}>
      <details
        open={abierto}
        onToggle={(evento) => setAbierto((evento.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          {/*
            La insignia deriva su color de un vocabulario CERRADO, y `TIMEOUT` o
            `UNKNOWN_BANK` no están en él: pasarlos como valor los pintaba grises,
            que es el color de «aquí no pasa nada». Viaja `REVIEW` —ámbar— con la
            categoría como etiqueta.
          */}
          <StatusBadge value="REVIEW" labels={{ REVIEW: REVIEW_REASON_LABEL[item.reviewReason] }} />
          <span className="revision-caso-archivo">{item.fileName}</span>
          <span className="revision-caso-espera">
            {/* La espera la mide el motor. Derivarla del reloj del navegador
                ordenaría la cola con la hora del equipo de quien mira. */}
            Esperando {pendingLabel(item.pendingMs)}
          </span>
          <span className="revision-caso-prioridad">
            {REVIEW_PRIORITY_LABEL[item.reviewPriority] ?? '—'}
          </span>
          {item.status === 'IN_REVIEW' ? (
            <span className="revision-caso-reclamado">
              En revisión por {item.reviewClaimedBy ?? 'alguien'}
            </span>
          ) : null}
        </summary>

        <dl className="revision-caso-hechos">
          <div>
            <dt>Usuario</dt>
            <dd>{item.requestedBy}</dd>
          </div>
          <div>
            <dt>Banco detectado</dt>
            <dd>{item.institutionId ?? 'No reconocido'}</dd>
          </div>
          <div>
            {/*
             * Las DOS confianzas, separadas y rotuladas. Es la distinción que
             * decide el caso: 99 % de que sea un extracto con 60 % de la
             * extracción es revisar cifras; 2 % de que lo sea no debería haber
             * llegado hasta aquí.
             */}
            <dt>Es un extracto</dt>
            <dd>{confidenceLabel(item.documentTypeConfidence)}</dd>
          </div>
          <div>
            <dt>Calidad de la extracción</dt>
            <dd>{confidenceLabel(item.extractionConfidence)}</dd>
          </div>
          <div>
            <dt>Movimientos leídos</dt>
            <dd>{item.transactionCount === null ? '—' : String(item.transactionCount)}</dd>
          </div>
          <div>
            <dt>En la cola desde</dt>
            <dd>{item.reviewOpenedAt ? formatDateTime(item.reviewOpenedAt) : '—'}</dd>
          </div>
        </dl>

        <section className="revision-caso-problema">
          <h4>Qué no se pudo resolver</h4>
          <p>{item.errorMessage ?? REVIEW_REASON_LABEL[item.reviewReason]}</p>
          {item.errorCode ? (
            <p className="field-help">
              Motivo <code>{item.reviewReason}</code> · código técnico <code>{item.errorCode}</code>
            </p>
          ) : null}
        </section>

        {detalle.isPending ? (
          <p className="categoria-vacio">Cargando el caso…</p>
        ) : detalle.isError ? (
          <p className="categoria-vacio">No se pudo leer el detalle de este caso.</p>
        ) : detalle.data ? (
          <>
            {/*
             * El documento original ya no siempre está: se conserva mientras el
             * caso sigue abierto y se borra al cerrarlo. Decirlo es lo honesto —y
             * es lo que explica que «Reprocesar» pueda estar apagado—.
             */}
            <p className="field-help">
              {detalle.data.documentAvailable
                ? 'El PDF original sigue guardado: se puede reprocesar sin volver a subirlo. Se borra al cerrar el caso.'
                : 'El PDF original ya no está guardado. Para volver a intentarlo hay que subirlo de nuevo.'}
            </p>

            {detalle.data.result ? (
              <section className="revision-caso-extraido">
                <h4>Información extraída</h4>
                <StatementResultView
                  result={detalle.data.result}
                  warnings={detalle.data.warnings}
                />
              </section>
            ) : (
              <p className="categoria-vacio">
                No se extrajo ningún movimiento: no hay nada que contrastar contra el documento.
              </p>
            )}

            <StatementReviewActions detalle={detalle.data} />

            <p className="field-help">
              Solicitud <code>{item.requestId}</code> · correlación{' '}
              <code>{detalle.data.correlationId}</code>
            </p>
          </>
        ) : null}
      </details>
    </li>
  );
}
