import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, HelpCircle, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { canRequestCaseInformation } from '../auth/business-rules';
import { useAuth } from '../auth/useAuth';
import { Alert } from '../components/Alert';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { Timeline } from '../components/Timeline';
import { CaseFilePanel } from '../features/manual-review/CaseFilePanel';
import { CaseInformationRequestDialog } from '../features/manual-review/CaseInformationRequestDialog';
import { notifyApiError } from '../features/tutorial/error-tutorial';
import { useInteractiveTutorial } from '../features/tutorial/useInteractiveTutorial';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { useNotifications } from '../notifications/useNotifications';
import { asRecord, display, resolvePath } from '../utils/records';

const RESOLUTION_LABEL: Record<string, string> = {
  APPROVE: 'aprobado',
  REJECT: 'rechazado',
  ESCALATE: 'escalado',
};

interface ManualReviewDetailPageProps {
  caseId: string;
}

export function ManualReviewDetailPage({ caseId }: ManualReviewDetailPageProps) {
  // Sin decisión previa: un caso de revisión manual no puede llegar con la
  // respuesta ya puesta. Preseleccionar «Aprobar» convierte un descuido —pulsar
  // sin leer— en una aprobación con nombre y apellidos en la auditoría.
  const [resolution, setResolution] = useState('');
  const [comments, setComments] = useState('');
  const [askingInformation, setAskingInformation] = useState(false);
  const { notify } = useNotifications();
  const { user } = useAuth();
  const { startForError } = useInteractiveTutorial();
  const query = useDetailQuery<unknown>(
    'manual-review',
    caseId ? `/v1/manual-reviews/${encodeURIComponent(caseId)}` : null,
  );
  const review = asRecord(query.data);
  const canAskInformation = canRequestCaseInformation(user?.roles ?? []);
  // El caso puede traer la ejecución anidada o sólo su identificador plano.
  const executionId = String(
    resolvePath(review, 'execution.id') ?? review.executionId ?? review.decisionExecutionId ?? '',
  );
  const resolve = useMutation({
    // Esta vista muestra el fallo ella misma, con acceso al tutorial que enseña a
    // corregirlo: sin `handled` el aviso global de QueryProvider lo repetiría.
    meta: { handled: true },
    mutationFn: () =>
      apiRequest(`/v1/manual-reviews/${encodeURIComponent(caseId)}/resolve`, {
        method: 'POST',
        body: { resolution, comments },
      }),
    onSuccess: () => {
      // Capture the resolution before clearing, so the toast reports what was
      // actually sent rather than whatever the form holds afterwards.
      const outcome = RESOLUTION_LABEL[resolution] ?? resolution;
      setComments('');
      void query.refetch();
      notify({
        tone: resolution === 'APPROVE' ? 'success' : 'info',
        title: `Caso ${outcome}`,
        description: `REV-${display(review, 'id')} se resolvió y salió de la cola.`,
      });
    },
    onError: (error) => notifyApiError(error, notify, startForError),
  });

  return (
    <>
      <PageHeader
        eyebrow="F5-04 · Manual Review"
        title={`Case #REV-${display(review, 'id')}`}
        description={`${display(review, 'queueCode')} · ${display(review, 'reason')}`}
        actions={
          <>
            <button
              className="button"
              type="button"
              disabled={!canAskInformation || !caseId}
              title={
                canAskInformation
                  ? 'Pedir un dato que falta, al backend central, al cliente o a un equipo interno'
                  : 'Requiere rol Risk Analyst, Fraud Analyst u Operations'
              }
              onClick={() => setAskingInformation(true)}
            >
              <HelpCircle size={16} /> Solicitar información
            </button>
            <button
              className="button"
              type="button"
              disabled
              title="La asignación de casos aún no está expuesta por el Decision Engine; resuelve el caso desde el formulario"
            >
              <UserCheck size={16} /> Assign to me
            </button>
          </>
        }
      />
      {askingInformation ? (
        <CaseInformationRequestDialog
          caseId={caseId}
          onClose={() => setAskingInformation(false)}
          onRequested={() => void query.refetch()}
        />
      ) : null}
      {query.isError || resolve.isError ? (
        <Alert tone="error">{errorMessage(query.error ?? resolve.error)}</Alert>
      ) : null}
      <div className="review-detail-grid">
        <main>
          <Panel title="Case Metadata" meta={display(review, 'status')}>
            <DefinitionGrid
              record={review}
              items={[
                { label: 'Priority', keys: ['priority'] },
                { label: 'Queue', keys: ['queueCode'] },
                { label: 'Artifact', keys: ['artifactCode'] },
                { label: 'Customer Ref', keys: ['subjectReference'], mono: true },
                { label: 'Assigned To', keys: ['assignedTo'] },
                { label: 'SLA Due', keys: ['slaDueAt'] },
              ]}
            />
          </Panel>
          <Panel title="Transaction Audit Timeline" meta="Immutable">
            <Timeline
              items={[
                {
                  title: 'Decision executed',
                  detail: display(review, 'reason'),
                  meta: display(review, 'createdAt'),
                },
                {
                  title: 'Case routed to manual review',
                  detail: display(review, 'queueCode'),
                  meta: display(review, 'updatedAt'),
                },
              ]}
            />
          </Panel>
          {/*
            El expediente completo —quién es el solicitante, con qué datos se
            decidió y por qué motivos— es lo que el analista de riesgo necesita
            para valorar el caso. Antes sólo había una instantánea cruda.
          */}
          <CaseFilePanel executionId={executionId} />
        </main>
        <aside data-tutorial-id="review-resolution">
          <Panel title="Resolution Form" meta="Required">
            <label className="field">
              <span>Decision</span>
              <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
                <option value="">Elegir una decisión…</option>
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
                <option value="ESCALATE">Escalate</option>
              </select>
            </label>
            <label className="field">
              <span>Mandatory comments</span>
              <textarea
                rows={8}
                value={comments}
                onChange={(event) => setComments(event.target.value)}
              />
            </label>
            <button
              className="button button-primary full-width"
              disabled={!resolution || !comments || !caseId || resolve.isPending}
              onClick={() => resolve.mutate()}
              type="button"
            >
              {resolve.isPending ? (
                <span className="inline-spinner" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {resolve.isPending ? 'Enviando…' : 'Submit Decision'}
            </button>
          </Panel>
        </aside>
      </div>
    </>
  );
}
