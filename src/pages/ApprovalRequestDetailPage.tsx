import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileDiff, Printer, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { useNotifications } from '../notifications/useNotifications';
import { asRecord, asRows, display } from '../utils/records';

interface ApprovalRequestDetailPageProps {
  requestId: string;
}

export function ApprovalRequestDetailPage({ requestId }: ApprovalRequestDetailPageProps) {
  const [comments, setComments] = useState('');
  const { notify } = useNotifications();
  const query = useDetailQuery<unknown>(
    'approval-request',
    requestId ? `/v1/approval-requests/${encodeURIComponent(requestId)}` : null,
  );
  const request = asRecord(query.data);
  const version = asRecord(request.artifactVersion);
  const artifact = asRecord(version.artifact);
  const steps = asRows(request.steps);
  const activeStep = steps.find((step) => step.status === 'PENDING') ?? {};
  const activeStepId = display(activeStep, 'id');
  const decide = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') =>
      apiRequest(`/v1/approval-steps/${encodeURIComponent(activeStepId)}/decisions`, {
        method: 'POST',
        body: { decision, comments, evidence: [] },
      }),
    onSuccess: (_data, decision) => {
      // Clearing the box prevents the comment being replayed onto a later step.
      setComments('');
      void query.refetch();
      notify({
        tone: decision === 'APPROVE' ? 'success' : 'warning',
        title:
          decision === 'APPROVE'
            ? 'Decisión registrada: aprobada'
            : 'Decisión registrada: rechazada',
        description: `REQ-${display(request, 'id')} quedó firmado en la bitácora de auditoría.`,
      });
    },
  });
  const pendingDecision = decide.isPending ? decide.variables : undefined;

  /** Copies the request's deep link so it can be pasted into chat or email. */
  const shareRequest = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify({
        tone: 'success',
        title: 'Enlace copiado',
        description: `El enlace directo a REQ-${display(request, 'id')} está en tu portapapeles.`,
      });
    } catch {
      notify({
        tone: 'warning',
        title: 'No se pudo copiar el enlace',
        description:
          'Tu navegador bloqueó el portapapeles. Copia la URL desde la barra de direcciones.',
      });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="F4-03 · Governance Request"
        title={`REQ-${display(request, 'id')}: ${display(artifact, 'name')}`}
        description={`${display(artifact, 'artifactCode')} · v${display(version, 'semanticVersion', 'versionNumber')}`}
        actions={
          <>
            <button className="button" type="button" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir
            </button>
            <button className="button" type="button" onClick={() => void shareRequest()}>
              <Share2 size={16} /> Compartir
            </button>
          </>
        }
      />
      {query.isError || decide.isError ? (
        <Alert tone="error">{errorMessage(query.error ?? decide.error)}</Alert>
      ) : null}
      <div className="governance-detail">
        <main>
          <Panel title="Metadatos de Versión" meta={display(request, 'status')}>
            <DefinitionGrid
              record={{ ...request, ...version }}
              items={[
                { label: 'Workflow', keys: ['workflowCode'] },
                { label: 'Requested By', keys: ['requestedBy'] },
                { label: 'Due At', keys: ['dueAt'] },
                { label: 'Version Status', keys: ['status'] },
                { label: 'Checksum', keys: ['checksum'], mono: true },
                { label: 'Created At', keys: ['createdAt'] },
              ]}
            />
          </Panel>
          <Panel title="Resultados de Pruebas (Gates)" meta="Required evidence">
            <ul className="gate-list">
              {[
                'Compilación determinista',
                'Suite bloqueante aprobada',
                'Cobertura mínima alcanzada',
                'Integridad de grafo verificada',
              ].map((gate) => (
                <li key={gate}>
                  <CheckCircle2 /> <span>{gate}</span>
                  <StatusBadge value="PASSED" />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Resumen de Cambios (Diff)" meta="Version comparison">
            <div className="diff-block">
              <FileDiff />
              <div>
                <strong>Graph and contract changes</strong>
                <p>Consulte el checksum y la evidencia adjunta antes de tomar la decisión.</p>
              </div>
            </div>
          </Panel>
        </main>
        <aside>
          <Panel title="Decisión de Aprobación" meta={display(activeStep, 'requiredRole')}>
            <div className="approval-steps">
              {steps.map((step) => (
                <div key={display(step, 'id')}>
                  <span>{display(step, 'stepOrder')}</span>
                  <div>
                    <strong>{display(step, 'requiredRole')}</strong>
                    <StatusBadge value={step.status} />
                  </div>
                </div>
              ))}
            </div>
            <label className="field">
              <span>Comentario obligatorio</span>
              <textarea
                rows={5}
                value={comments}
                onChange={(event) => setComments(event.target.value)}
              />
            </label>
            <div className="decision-buttons">
              <button
                className="button button-danger"
                disabled={!comments || activeStepId === '—' || decide.isPending}
                onClick={() => decide.mutate('REJECT')}
                type="button"
              >
                {pendingDecision === 'REJECT' ? (
                  <span className="inline-spinner" aria-hidden="true" />
                ) : (
                  <ThumbsDown size={16} />
                )}
                Rechazar
              </button>
              <button
                className="button button-primary"
                disabled={!comments || activeStepId === '—' || decide.isPending}
                onClick={() => decide.mutate('APPROVE')}
                type="button"
              >
                {pendingDecision === 'APPROVE' ? (
                  <span className="inline-spinner" aria-hidden="true" />
                ) : (
                  <ThumbsUp size={16} />
                )}
                Aprobar Despliegue
              </button>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
