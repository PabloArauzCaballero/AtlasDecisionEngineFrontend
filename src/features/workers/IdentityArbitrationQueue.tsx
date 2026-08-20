'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../config/locale';
import {
  claimIdentityReview,
  fetchIdentityReviewCategories,
  fetchIdentityReviews,
  resolveIdentityReview,
} from './identity-review.api';
import {
  IDENTITY_CONFIRMABLE_TYPES,
  IDENTITY_REASON_HELP,
  IDENTITY_REASON_LABEL,
  IDENTITY_REJECTION_LABEL,
  IDENTITY_REJECTION_REASONS,
  IDENTITY_TYPE_LABEL,
  pendingLabel,
  type IdentityConfirmableType,
  type IdentityRejectionReason,
  type IdentityReviewItem,
  type IdentityReviewReason,
} from './identity-review';

/** Cuántos casos por página. El motor la impone igual; esto es la petición. */
const PAGE_SIZE = 20;

/**
 * Arbitraje humano de documentos de identidad.
 *
 * Es el destinatario de la única franja en la que la puerta del worker no decide
 * sola. Y **no es el vertedero de lo que el motor no entendió**: lo que llega
 * aquí ya pasó el triage, así que es, por construcción, algo que se parece a un
 * documento lo bastante como para que una persona pueda confirmarlo mirando. Una
 * factura o una foto de un paisaje se quedan en el historial como rechazadas, y
 * la garantía no depende de que esta pantalla se acuerde de filtrarlas: el motor
 * no las devuelve por esta ruta.
 *
 * Dos acciones y no cuatro, porque la pregunta que se hizo es una sola: **¿esto
 * es un documento de identidad admisible?** Confirmar exige nombrar el tipo —sin
 * él no hay analizador, y el caso volvería a esta misma cola por el mismo
 * motivo— y rechazar exige un motivo, porque un rechazo sin motivo no es
 * medible.
 *
 * Quién arbitra lo decide el ENTORNO del motor (`IDENTITY_ARBITRATION_MODE`).
 * Hoy es una persona, aquí; el día que sea un modelo, esta pestaña seguirá
 * existiendo para lo que el modelo tampoco cierre, y la columna «arbitraje» dirá
 * cuál de los dos miró cada caso.
 */
export function IdentityArbitrationQueue({ active }: { active: boolean }) {
  const [category, setCategory] = useState<IdentityReviewReason | null>(null);
  const [page, setPage] = useState(1);

  const categorias = useQuery({
    queryKey: ['identity-review-categories'],
    queryFn: ({ signal }) => fetchIdentityReviewCategories(signal),
    // La pestaña que no se ve sigue montada para conservar su estado: que no
    // siga además preguntándole al motor.
    enabled: active,
    refetchInterval: active ? 30_000 : false,
  });

  const cola = useQuery({
    queryKey: ['identity-reviews', category, page],
    queryFn: ({ signal }) =>
      fetchIdentityReviews({ category: category ?? undefined, page, pageSize: PAGE_SIZE }, signal),
    enabled: active,
    refetchInterval: active ? 30_000 : false,
  });

  const tabs = categorias.data ?? [];
  const items = cola.data?.items ?? [];
  const total = cola.data?.total ?? 0;
  const totalPages = cola.data?.totalPages ?? 1;

  function elegirCategoria(valor: IdentityReviewReason | null) {
    setCategory(valor);
    // Cambiar de pestaña vuelve a la primera página: quedarse en la 7 de una
    // categoría que tiene 2 enseña una lista vacía que se lee como «no hay nada».
    setPage(1);
  }

  return (
    <div className="worker-console">
      <Panel
        title="Arbitraje de documentos"
        meta={total > 0 ? `${String(total)} por decidir` : undefined}
      >
        <p className="field-help">
          Documentos que la puerta del motor no pudo confirmar ni descartar por su cuenta. Lo que
          no es un documento de identidad no llega aquí: se rechaza y queda en el historial.
        </p>

        {/*
         * Las mismas clases que la cola de extractos, y no unas propias: son la
         * misma pieza de interfaz haciendo el mismo trabajo, y dos hojas de
         * estilo para dos colas idénticas divergen a la primera mejora que
         * alguien haga en una sola de ellas.
         */}
        <div className="revision-categorias" role="tablist" aria-label="Categorías de arbitraje">
          {tabs.map((tab) => {
            const seleccionada = tab.category === category;
            return (
              <button
                key={tab.category ?? 'todos'}
                type="button"
                role="tab"
                aria-selected={seleccionada}
                className="revision-categoria"
                data-activa={seleccionada ? 'true' : undefined}
                onClick={() => elegirCategoria(tab.category)}
                title={
                  tab.oldestPendingMs === null
                    ? undefined
                    : `El más antiguo lleva ${pendingLabel(tab.oldestPendingMs)}`
                }
              >
                {tab.category === null ? 'Todos' : IDENTITY_REASON_LABEL[tab.category]}
                <span className="revision-categoria-cuenta">{String(tab.total)}</span>
              </button>
            );
          })}
        </div>

        {category !== null ? (
          <p className="field-help">{IDENTITY_REASON_HELP[category]}</p>
        ) : null}

        {cola.isPending && active ? (
          <p className="categoria-vacio">Cargando la cola…</p>
        ) : cola.isError ? (
          <p className="categoria-vacio">No se pudo leer la cola de arbitraje.</p>
        ) : items.length === 0 ? (
          <p className="categoria-vacio">No hay documentos esperando a una persona.</p>
        ) : (
          <ul className="revision-lista">
            {items.map((item) => (
              <CasoDeArbitraje key={item.requestId} item={item} />
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <nav className="revision-paginacion" aria-label="Páginas de la cola de arbitraje">
            <button
              type="button"
              className="button"
              disabled={page <= 1 || cola.isFetching}
              onClick={() => setPage((actual) => Math.max(1, actual - 1))}
            >
              Anterior
            </button>
            {/*
             * El total viene del motor y no de contar lo cargado: la página trae
             * 20 casos y decir «20 pendientes» sobre una cola de cuatrocientos es
             * la forma de que nadie sepa que hay más.
             */}
            <span className="revision-paginacion-estado">
              Página {String(page)} de {String(totalPages)} · {String(total)} casos
            </span>
            <button
              type="button"
              className="button"
              disabled={!cola.data?.hasNextPage || cola.isFetching}
              onClick={() => setPage((actual) => actual + 1)}
            >
              Siguiente
            </button>
          </nav>
        ) : null}
      </Panel>
    </div>
  );
}

/**
 * Un caso, con lo que hace falta para decidirlo y las dos acciones que lo cierran.
 *
 * Se reclama antes de resolver, y no es burocracia: sin el reclamo, dos personas
 * gastan su tarde en el mismo documento y la segunda descubre al pulsar que ya
 * estaba resuelto. El motor lo impone además en el servidor —sólo quien reclamó
 * puede cerrar— así que este botón no es la garantía, es su reflejo.
 */
function CasoDeArbitraje({ item }: { item: IdentityReviewItem }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [documentType, setDocumentType] = useState<IdentityConfirmableType>('BOLIVIA_CI');
  const [rejectionReason, setRejectionReason] =
    useState<IdentityRejectionReason>('NOT_AN_IDENTITY_DOCUMENT');

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

  return (
    <li className="revision-caso" data-prioridad={item.reviewPriority ?? undefined}>
      <details>
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
            <label className="field">
              <span className="field-label">Qué documento es</span>
              <select
                value={documentType}
                onChange={(evento) =>
                  setDocumentType(evento.target.value as IdentityConfirmableType)
                }
              >
                {IDENTITY_CONFIRMABLE_TYPES.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {IDENTITY_TYPE_LABEL[tipo]}
                  </option>
                ))}
              </select>
              <span className="field-help">
                Al confirmar, la verificación se reanuda desde el principio con este tipo ya
                decidido: la puerta no vuelve a preguntar.
              </span>
            </label>

            <label className="field">
              <span className="field-label">Si no lo es, por qué</span>
              <select
                value={rejectionReason}
                onChange={(evento) =>
                  setRejectionReason(evento.target.value as IdentityRejectionReason)
                }
              >
                {IDENTITY_REJECTION_REASONS.map((motivo) => (
                  <option key={motivo} value={motivo}>
                    {IDENTITY_REJECTION_LABEL[motivo]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Por qué decidiste esto</span>
              <textarea
                value={notes}
                onChange={(evento) => setNotes(evento.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Queda en la fila y en la auditoría."
              />
            </label>

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
