'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useNotifications } from '../../notifications/useNotifications';
import {
  claimStatementReview,
  reprocessStatementReview,
  resolveStatementReview,
} from './statement-review.api';
import {
  REJECTION_REASON_LABEL,
  REJECTION_REASONS,
  REVIEW_ACTION_LABEL,
  REVIEW_ACTIONS,
  type ReviewAction,
  type StatementRejectionReason,
  type StatementReviewDetail,
} from './statement-review';

/**
 * Lo que una persona puede hacer con un caso.
 *
 * **Reclamar va primero y no es ceremonia.** El motor exige que quien resuelve
 * sea quien reclamó, por la misma segregación que gobierna la revisión manual de
 * decisiones: sin ella, dos analistas trabajan el mismo documento sin saberlo y
 * el segundo descubre al pulsar que ya estaba decidido. La pantalla lo refleja
 * apagando las acciones hasta que el caso es tuyo, en vez de dejarlas pulsables
 * para que el motor conteste 409.
 *
 * Cada acción deja un toast con lo que ocurrió de verdad —el texto se escribe
 * después de que el motor confirme, nunca junto a la llamada— y queda en la
 * auditoría del motor.
 */
export function StatementReviewActions({ detalle }: { detalle: StatementReviewDetail }) {
  const cliente = useQueryClient();
  const { user } = useAuth();
  const { notify, promise } = useNotifications();
  const [accion, setAccion] = useState<ReviewAction>('APPROVE');
  const [motivo, setMotivo] = useState<StatementRejectionReason>('NOT_BANK_STATEMENT');
  const [notas, setNotas] = useState('');

  /*
   * Reclamado, y reclamado POR MÍ. La segunda mitad no es un detalle: sin ella,
   * abrir el caso de otra persona enseñaba el formulario entero, y sólo al
   * pulsar «Registrar decisión» —con las notas ya escritas— el motor contestaba
   * 403. Ofrecer una acción que se sabe que va a ser rechazada es peor que no
   * ofrecerla.
   */
  const ajeno = detalle.status === 'IN_REVIEW' && detalle.reviewClaimedBy !== user?.id;
  const mio = detalle.status === 'IN_REVIEW' && !ajeno;

  async function refrescar() {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: ['statement-reviews'] }),
      cliente.invalidateQueries({ queryKey: ['statement-review-categories'] }),
      cliente.invalidateQueries({ queryKey: ['statement-review', detalle.requestId] }),
    ]);
  }

  const reclamar = useMutation({
    mutationFn: () =>
      promise(claimStatementReview(detalle.requestId), {
        loading: 'Reclamando el caso…',
        success: 'Caso reclamado: es tuyo mientras lo revisas.',
      }),
    onSuccess: refrescar,
  });

  const resolver = useMutation({
    mutationFn: () =>
      promise(
        resolveStatementReview(detalle.requestId, {
          action: accion,
          notes: notas,
          ...(accion === 'MARK_INVALID' ? { rejectionReason: motivo } : {}),
        }),
        {
          loading: 'Registrando la decisión…',
          success:
            accion === 'MARK_INVALID'
              ? 'Documento marcado como PDF no válido. Sale de la cola y queda en el historial como rechazado.'
              : `Caso resuelto: ${REVIEW_ACTION_LABEL[accion].toLowerCase()}.`,
        },
      ),
    onSuccess: refrescar,
  });

  const reprocesar = useMutation({
    mutationFn: () =>
      promise(reprocessStatementReview(detalle.requestId), {
        loading: 'Devolviendo el documento a la cola…',
        success: 'Reencolado: el motor volverá a intentarlo y el caso sale de la cola de revisión.',
      }),
    onSuccess: refrescar,
  });

  if (ajeno) {
    return (
      <p className="field-help">
        Este caso lo está revisando <strong>{detalle.reviewClaimedBy}</strong>. Sólo quien lo
        reclamó puede decidirlo: así la decisión queda atribuida a quien la tomó y dos personas no
        trabajan sobre el mismo documento sin saberlo.
      </p>
    );
  }

  if (!mio) {
    return (
      <div className="worker-run-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={reclamar.isPending}
          onClick={() => reclamar.mutate()}
        >
          {reclamar.isPending ? 'Reclamando…' : 'Reclamar para revisar'}
        </button>
        <p className="field-help">
          Hay que reclamar el caso antes de decidirlo. Así nadie más trabaja sobre el mismo
          documento sin saberlo, y la decisión queda atribuida a quien la tomó.
        </p>
      </div>
    );
  }

  return (
    <form
      className="revision-acciones"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (notas.trim().length === 0) {
          // Se avisa aquí y no se deja que el motor conteste 400: la explicación
          // es el único rastro de POR QUÉ un documento dudoso se aprobó.
          notify({
            tone: 'warning',
            title: 'Falta la explicación',
            description: 'Escribe por qué decides esto: queda en la auditoría del caso.',
          });
          return;
        }
        resolver.mutate();
      }}
    >
      <label className="field">
        <span>Decisión</span>
        <select
          value={accion}
          onChange={(evento) => setAccion(evento.target.value as ReviewAction)}
        >
          {REVIEW_ACTIONS.map((valor) => (
            <option key={valor} value={valor}>
              {REVIEW_ACTION_LABEL[valor]}
            </option>
          ))}
        </select>
      </label>

      {accion === 'MARK_INVALID' ? (
        <label className="field">
          <span>Motivo del rechazo</span>
          <select
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value as StatementRejectionReason)}
          >
            {REJECTION_REASONS.map((valor) => (
              <option key={valor} value={valor}>
                {REJECTION_REASON_LABEL[valor]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="field revision-acciones-notas">
        <span>Por qué</span>
        <textarea
          value={notas}
          rows={3}
          maxLength={2_000}
          placeholder="Qué comprobaste y qué concluyes."
          onChange={(evento) => setNotas(evento.target.value)}
        />
      </label>

      <div className="worker-run-actions">
        <button type="submit" className="button button-primary" disabled={resolver.isPending}>
          {resolver.isPending ? 'Registrando…' : 'Registrar decisión'}
        </button>
        <button
          type="button"
          className="button"
          disabled={reprocesar.isPending || !detalle.documentAvailable}
          title={
            detalle.documentAvailable
              ? undefined
              : 'El PDF original ya no está guardado: hay que volver a subirlo.'
          }
          onClick={() => reprocesar.mutate()}
        >
          {reprocesar.isPending ? 'Reencolando…' : 'Reprocesar'}
        </button>
      </div>
    </form>
  );
}
