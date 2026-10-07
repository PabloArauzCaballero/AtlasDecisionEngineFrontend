'use client';

import { useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { ArtifactVersionPicker } from '../../components/ArtifactVersionPicker';
import { Panel } from '../../components/Panel';
import { asRecord, display, type UnknownRecord } from '../../utils/records';
import { submitBlockerForStatus } from './submit-review';
import { useSubmitForReview } from './useSubmitForReview';

/**
 * «Enviar a revisión», encima de la bandeja.
 *
 * Proponer un cambio es de quien lo escribió (QA o Fraude); aprobarlo, de otras dos personas. Por eso este bloque
 * sólo envía: la decisión se toma en el detalle de la solicitud. Acepta `?versionId=` para llegar ya elegida desde
 * «Validar y compilar» o desde «Volver a la versión anterior».
 */
export function SubmitForReviewPanel() {
  const [versionId, setVersionId] = useState('');
  const [initialVersionId, setInitialVersionId] = useState('');
  const review = useSubmitForReview(versionId);

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get('versionId');
    if (prefill && /^[1-9][0-9]*$/.test(prefill)) setInitialVersionId(prefill);
  }, []);

  const version = useQuery({
    queryKey: ['submit-review-version', versionId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/artifact-versions/${encodeURIComponent(versionId)}`, {
        signal,
      }),
    enabled: Boolean(versionId),
    retry: false,
  });
  const status = version.data ? display(asRecord(version.data), 'status') : null;
  // Recién enviada, la versión pasa a «en revisión»: ese aviso lo da el mensaje de éxito, no un bloqueo.
  const blocker = review.requestId ? null : submitBlockerForStatus(status === '—' ? null : status);
  const waiting = Boolean(versionId) && version.isPending;

  return (
    <Panel title="Enviar una versión a revisión" meta="Sólo versiones compiladas">
      <form
        className="compact-form"
        data-tutorial-id="reviews-submit"
        onSubmit={(event) => {
          event.preventDefault();
          if (review.canPropose && versionId && !blocker) review.submit();
        }}
      >
        {review.canPropose ? null : (
          <Alert tone="info">
            Enviar a revisión es de quien propone el cambio: analista de calidad o de fraude. Con tu
            rol puedes consultar y firmar las solicitudes de la tabla.
          </Alert>
        )}
        <ArtifactVersionPicker
          versionId={versionId}
          onVersionChange={(next) => {
            setVersionId(next);
            review.reset();
          }}
          initialVersionId={initialVersionId}
          versionLabel="Versión a enviar"
          required
        />
        {versionId && blocker ? <Alert tone="warning">{blocker}</Alert> : null}
        {review.problem ? <Alert tone="error">{review.problem}</Alert> : null}
        {review.requestId ? (
          <Alert tone="success">
            Solicitud creada.{' '}
            <Link href={`/approval-requests/${review.requestId}`}>
              Ver la solicitud REQ-{review.requestId}
            </Link>
          </Alert>
        ) : null}
        <button
          className="button button-primary"
          type="submit"
          disabled={
            !review.canPropose ||
            !versionId ||
            Boolean(blocker) ||
            review.pending ||
            waiting ||
            Boolean(review.requestId)
          }
          title={
            !review.canPropose
              ? 'Tu rol no envía versiones a revisión'
              : !versionId
                ? 'Elige primero el algoritmo y la versión'
                : (blocker ?? undefined)
          }
        >
          <Send size={16} /> {review.pending ? 'Enviando…' : 'Enviar a revisión'}
        </button>
      </form>
    </Panel>
  );
}
