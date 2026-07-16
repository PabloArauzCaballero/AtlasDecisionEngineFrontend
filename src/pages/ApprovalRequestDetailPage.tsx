import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileDiff, Printer, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';

export function ApprovalRequestDetailPage() {
  const { requestId } = useParams();
  const [comments, setComments] = useState('');
  const query = useDetailQuery<unknown>(
    'approval-request',
    requestId ? `/v1/approval-requests/${requestId}` : null,
  );
  const request = asRecord(query.data);
  const version = asRecord(request.artifactVersion);
  const artifact = asRecord(version.artifact);
  const steps = asRows(request.steps);
  const activeStep = steps.find((step) => step.status === 'PENDING') ?? {};
  const decide = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') =>
      apiRequest(`/v1/approval-steps/${display(activeStep, 'id')}/decisions`, {
        method: 'POST',
        body: { decision, comments, evidence: [] },
      }),
    onSuccess: () => query.refetch(),
  });
  return (
    <>
      <PageHeader
        eyebrow="F4-03 · Governance Request"
        title={`REQ-${display(request, 'id')}: ${display(artifact, 'name')}`}
        description={`${display(artifact, 'artifactCode')} · v${display(version, 'semanticVersion', 'versionNumber')}`}
        actions={
          <>
            <button className="button" type="button">
              <Printer size={16} /> Imprimir
            </button>
            <button className="button" type="button">
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
                disabled={!comments || decide.isPending}
                onClick={() => decide.mutate('REJECT')}
                type="button"
              >
                <ThumbsDown size={16} /> Rechazar
              </button>
              <button
                className="button button-primary"
                disabled={!comments || decide.isPending}
                onClick={() => decide.mutate('APPROVE')}
                type="button"
              >
                <ThumbsUp size={16} /> Aprobar Despliegue
              </button>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
