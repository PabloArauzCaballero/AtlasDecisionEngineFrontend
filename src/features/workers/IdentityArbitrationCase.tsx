'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../config/locale';
import { claimIdentityReview, resolveIdentityReview } from './identity-review.api';
import { ImagenesDeLaEjecucion } from './IdentityRunImagesPanel';
import {
  IDENTITY_CONFIRMABLE_TYPES,
  IDENTITY_REASON_LABEL,
  IDENTITY_REJECTION_LABEL,
  IDENTITY_REJECTION_REASONS,
  IDENTITY_TYPE_LABEL,
  pendingLabel,
  type IdentityConfirmableType,
  type IdentityRejectionReason,
  type IdentityReviewItem,
} from './identity-review';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';

/**
 * Un caso, con lo que hace falta para decidirlo y las dos acciones que lo cierran.
 *
 * Se reclama antes de resolver, y no es burocracia: sin el reclamo, dos personas
 * gastan su tarde en el mismo documento y la segunda descubre al pulsar que ya
 * estaba resuelto. El motor lo impone además en el servidor —sólo quien reclamó
 * puede cerrar— así que este botón no es la garantía, es su reflejo.
 */
export function CasoDeArbitraje({ item }: { item: IdentityReviewItem }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [documentType, setDocumentType] = useState<IdentityConfirmableType>('BOLIVIA_CI');
  const [rejectionReason, setRejectionReason] = useState<IdentityRejectionReason>(
    'NOT_AN_IDENTITY_DOCUMENT',
  );

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['identity-reviews'] });
    void queryClient.invalidateQueries({ queryKey: ['identity-review-categories'] });
  };

  const reclamar = useMutation({
    mutationFn: () => claimIdentityReview(item.requestId),
    onSuccess: refrescar,
  });

  const resolver = useMutation({
    mutationFn: (accion: 'CONFIRM_DOCUMENT' | 'REJECT_DOCUMENT') =>
      resolveIdentityReview(item.requestId, {
        action: accion,
        notes,
        ...(accion === 'CONFIRM_DOCUMENT' ? { documentType } : { rejectionReason }),
      }),
    onSuccess: refrescar,
  });

  const mio = item.status === 'IN_REVIEW';
  const evidencia = item.documentTypeConfidence;

  /*
   * Las imágenes sólo se piden con el caso ABIERTO.
   *
   * La cola pinta veinticinco casos por página y cada uno es un `<details>` cerrado. Montar el
   * panel sin esta guarda descargaría el carnet y la cara de veinticinco personas para enseñar una
   * lista de resúmenes: megas de PII moviéndose por la red sin que nadie las mire, y la pantalla
   * tardando en aparecer por culpa de lo que aún no se ha abierto. Es el mismo motivo por el que la
   * consulta de la cola en el motor NO selecciona las columnas de imágenes.
   */
  const [abierto, setAbierto] = useState(false);

  return (
    <li className="revision-caso" data-prioridad={item.reviewPriority ?? undefined}>
      <details onToggle={(evento) => setAbierto(evento.currentTarget.open)}>
        <summary>
          <StatusBadge
            value={mio ? 'RUNNING' : 'WARNING'}
            labels={{ RUNNING: 'En revisión', WARNING: 'Sin reclamar' }}
          />
          <span className="revision-caso-espera">{pendingLabel(item.pendingMs)}</span>
          <span className="revision-caso-hechos">
            {evidencia === null
              ? 'Sin evidencia medida'
              : `Evidencia ${String(Math.round(evidencia * 100))} %`}
          </span>
          <span className="revision-caso-prioridad">
            {IDENTITY_REASON_LABEL[item.reviewReason] ?? item.reviewReason}
          </span>
        </summary>

        {/*
          Las imágenes van ARRIBA del todo, antes del detalle y de los botones.

          Es el orden en que se hace el trabajo: se mira el carnet y la cara, y sólo después se
          decide. Ponerlas debajo del formulario invita a resolver por el código de motivo —que es
          exactamente lo que esta cola existía para evitar cuando no había imágenes que mirar.
        */}
        {abierto ? <ImagenesDeLaEjecucion requestId={item.requestId} /> : null}

        <p className="field-help">{item.errorMessage ?? 'Sin detalle del motor.'}</p>
        <p className="field-help">
          Solicitud <code>{item.requestId}</code> · pedida por <code>{item.requestedBy}</code> ·
          país <code>{item.documentCountry}</code> · tipo reconocido{' '}
          <code>{item.documentType ?? 'ninguno'}</code> · arbitraje{' '}
          <code>{item.arbitrationMode ?? 'HUMAN'}</code> · en cola desde{' '}
          {item.reviewOpenedAt ? formatDateTime(item.reviewOpenedAt) : '—'}
        </p>

        {!mio ? (
          <div className="worker-run-actions">
            <button
              type="button"
              className="button"
              disabled={reclamar.isPending}
              onClick={() => reclamar.mutate()}
            >
              Reclamar para revisar
            </button>
            {item.reviewClaimedBy ? (
              <span className="field-help">
                Lo tiene <code>{item.reviewClaimedBy}</code>.
              </span>
            ) : null}
          </div>
        ) : (
          <div className="identity-arbitration-form">
            <Field
              label={'Qué documento es'}
              tooltip="Tipo de documento que confirmas tras mirar la imagen."
            >
              <OptionSelect
                name="tipo-documento"
                value={documentType}
                onChange={(valor) => setDocumentType(valor as IdentityConfirmableType)}
                options={IDENTITY_CONFIRMABLE_TYPES.map((tipo) => ({
                  value: tipo, // sin-ayuda: nombres de documentos, se entienden por sí solos
                  label: IDENTITY_TYPE_LABEL[tipo],
                }))}
              />
              <span className="field-help">
                Al confirmar, la verificación se reanuda desde el principio con este tipo ya
                decidido: la puerta no vuelve a preguntar.
              </span>
            </Field>

            <Field
              label={'Si no lo es, por qué'}
              tooltip="Por qué la imagen no sirve como documento para este trámite."
            >
              <OptionSelect
                name="motivo-rechazo"
                value={rejectionReason}
                onChange={(valor) => setRejectionReason(valor as IdentityRejectionReason)}
                options={IDENTITY_REJECTION_REASONS.map((motivo) => ({
                  value: motivo, // sin-ayuda: cada rótulo ya es una frase que explica el motivo
                  label: IDENTITY_REJECTION_LABEL[motivo],
                }))}
              />
            </Field>

            <Field
              label="Por qué decidiste esto"
              tooltip="Tu razonamiento; queda en la fila y en la auditoría."
            >
              <textarea
                value={notes}
                onChange={(evento) => setNotes(evento.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Queda en la fila y en la auditoría."
              />
            </Field>

            <div className="worker-run-actions">
              <button
                type="button"
                className="button"
                disabled={resolver.isPending || notes.trim().length === 0}
                onClick={() => resolver.mutate('CONFIRM_DOCUMENT')}
              >
                Confirmar y reanudar
              </button>
              <button
                type="button"
                className="button button-ghost"
                disabled={resolver.isPending || notes.trim().length === 0}
                onClick={() => resolver.mutate('REJECT_DOCUMENT')}
              >
                Rechazar el documento
              </button>
            </div>
            {notes.trim().length === 0 ? (
              <p className="field-help">
                La nota es obligatoria: dentro de un mes, «se confirmó» sin más no explica nada.
              </p>
            ) : null}
            {resolver.isError ? (
              <p className="field-help">No se pudo cerrar el caso. Vuelve a intentarlo.</p>
            ) : null}
          </div>
        )}
      </details>
    </li>
  );
}
