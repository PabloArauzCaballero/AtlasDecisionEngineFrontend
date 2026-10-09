import { useMutation } from '@tanstack/react-query';
import { Download, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { useAuth } from '../auth/useAuth';
import { ApprovalStepsList } from '../features/governance/ApprovalStepsList';
import { DecisionConfirmDialog } from '../features/governance/DecisionConfirmDialog';
import {
  activeGovernanceRequest,
  evaluateDecisionGate,
} from '../features/governance/decision-policy';
import { useApprovalDecision, type Decision } from '../features/governance/useApprovalDecision';
import { useVersionGates } from '../features/governance/useVersionGates';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';
import { Field } from '../components/Field';
import { StatusBadge } from '../components/StatusBadge';
import { DecisionSteps } from '../features/analyst-review/DecisionSteps';
import { TestEvidence } from '../features/analyst-review/TestEvidence';
import { orderedSteps } from '../features/analyst-review/review-model';
import { SecurityDetails } from '../features/analyst-review/SecurityDetails';

interface SecurityReviewPageProps {
  versionId: string;
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Security team dashboard (Fase 10): aggregated review data for one artifact
 * version — code, variables, nested trees, static analysis, governance history
 * and incidents — with real RBAC (backend-enforced, see
 * docs/security-review.md) for both viewing and deciding.
 */
export function SecurityReviewPage({ versionId }: SecurityReviewPageProps) {
  const [comments, setComments] = useState('');
  const path = versionId ? `/v1/security-review/versions/${encodeURIComponent(versionId)}` : null;
  const query = useDetailQuery<unknown>('security-review', path);
  // Lo que el analista firma: el grafo con sus reglas y las pruebas con sus corridas.
  const graphQuery = useDetailQuery<unknown>(
    'version-graph',
    versionId ? `/v1/artifact-versions/${encodeURIComponent(versionId)}/graph` : null,
  );
  const suitesQuery = useDetailQuery<unknown>(
    'version-test-suites',
    versionId ? `/v1/artifact-versions/${encodeURIComponent(versionId)}/test-suites` : null,
  );
  const graph = asRecord(graphQuery.data);
  const graphVersion = asRecord(graph.version);
  const outputs = asRows(graph.outputContract);
  const suites = asRows(asRecord(suitesQuery.data).items ?? suitesQuery.data);
  const steps = orderedSteps(graph);
  const review = asRecord(query.data);
  const artifact = asRecord(review.artifact);
  const governance = asRows(review.governance);

  /*
   * La firma desde aquí es la MISMA que en la solicitud de aprobación: el paso pendiente de menor
   * orden de la solicitud abierta, la misma política (`evaluateDecisionGate`: ni el solicitante
   * ni quien no tenga el rol del paso ven los botones), comentario obligatorio, confirmación con
   * la evidencia de las pruebas y clave de idempotencia. Antes un AUDITOR veía «Aprobar» y un
   * clic firmaba el primer PENDING que apareciera, sin nada de eso.
   */
  const { user } = useAuth();
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const openRequest = activeGovernanceRequest(governance);
  const gate = openRequest ? evaluateDecisionGate(openRequest, user) : null;
  const reviewVersion = asRecord(review.version);
  const { gates } = useVersionGates(openRequest ?? {}, {
    ...reviewVersion,
    id: reviewVersion.id ?? versionId,
  });
  const requestLabel = openRequest ? `REQ-${display(openRequest, 'id')}` : '';
  const decide = useApprovalDecision({
    requestLabel,
    refresh: () => void query.refetch(),
  });
  const blockedByComment = !comments.trim();

  const askConfirmation = (decision: Decision) => {
    decide.beginAttempt();
    setConfirming(decision);
  };

  const confirmDecision = () => {
    if (!gate?.canDecide || !gate.stepId || !confirming) return;
    decide.mutate(
      { stepId: gate.stepId, decision: confirming, comments },
      {
        onSuccess: () => {
          setComments('');
          setConfirming(null);
        },
        onError: () => setConfirming(null),
      },
    );
  };

  const exportReview = useMutation({
    /*
     * La ruta se escribe ENTERA, no como `${path}/export`.
     *
     * El gate de superficie (`scripts/engine-surface.mjs`) sigue la pista hasta el literal
     * `/v1/…` que haya en el mismo archivo. Interpolando sobre `path`, veía
     * `/v1/security-review/versions/{p}` y NO veía `/…/export`, así que daba esta operación por
     * no consumida — y la lista de deuda llevaba una fila de algo que llevaba tiempo hecho.
     * Una lista de deuda con entradas saldadas dentro deja de leerse, que es exactamente lo que
     * ese fichero existe para evitar.
     */
    mutationFn: () =>
      apiRequest<unknown>(
        `/v1/security-review/versions/${encodeURIComponent(versionId ?? '')}/export`,
      ),
    onSuccess: (data) => downloadJson(`security-review-${versionId}.json`, data),
  });

  return (
    <>
      <PageHeader
        eyebrow="Revisión de la versión"
        title={
          display(artifact, 'name', 'artifactCode') === '—'
            ? 'Revisión de seguridad'
            : display(artifact, 'name')
        }
        description={`${display(artifact, 'artifactCode')} · v${display(review.version ? asRecord(review.version) : {}, 'semanticVersion', 'versionNumber')}`}
        actions={
          <>
            <StatusBadge value={asRecord(review.version).status} />
            <button
              className="button"
              type="button"
              onClick={() => exportReview.mutate()}
              disabled={!path}
            >
              <Download size={16} /> Exportar reporte
            </button>
          </>
        }
      />
      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}

      <Panel title="Qué decide y por qué" meta={display(artifact, 'riskDomain')}>
        <div className="analyst-intro">
          {display(graphVersion, 'authoringNotes') !== '—' ? (
            <p>{display(graphVersion, 'authoringNotes')}</p>
          ) : (
            <p className="muted-text">La autora no dejó notas sobre esta versión.</p>
          )}
          {outputs.length ? (
            <ul className="analyst-step__why">
              {outputs.map((output) => (
                <li key={display(output, 'code')}>
                  <strong>{display(output, 'name', 'code')}</strong>
                  {display(output, 'description') !== '—'
                    ? `: ${display(output, 'description')}`
                    : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Panel>

      <Panel title="Paso a paso" meta={`${steps.length} pasos`}>
        {graphQuery.isError ? (
          <Alert tone="error">{errorMessage(graphQuery.error)}</Alert>
        ) : graphQuery.isLoading ? (
          <p className="muted-text">Leyendo el grafo…</p>
        ) : (
          <DecisionSteps steps={steps} />
        )}
      </Panel>

      <Panel title="Pruebas y corridas" meta={`${suites.length} suites`}>
        {suitesQuery.isError ? (
          <Alert tone="error">{errorMessage(suitesQuery.error)}</Alert>
        ) : (
          <TestEvidence suites={suites} graph={graph} />
        )}
      </Panel>

      {openRequest && gate ? (
        <Panel
          title="Tu firma"
          meta={`${requestLabel} · ${gate.requiredRole ? `Firma: ${gate.requiredRole}` : 'Sin rol indicado'}`}
        >
          <ApprovalStepsList request={openRequest} />
          {decide.staleState ? (
            <Alert tone="warning">
              La solicitud cambió mientras la revisabas: otra persona decidió este paso o el flujo
              avanzó. Se releyó el estado real; revísalo antes de volver a decidir.
            </Alert>
          ) : null}
          {gate.canDecide ? (
            <>
              <Field
                label="Comentario obligatorio"
                tooltip="Observaciones de la revisión de seguridad; quedan con el dictamen."
              >
                <textarea
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  rows={3}
                />
              </Field>
              <div className="inline-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => askConfirmation('REQUEST_CHANGES')}
                  disabled={blockedByComment || decide.isPending}
                >
                  Solicitar cambios
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => askConfirmation('REJECT')}
                  disabled={blockedByComment || decide.isPending}
                >
                  <ThumbsDown size={16} /> Rechazar
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => askConfirmation('APPROVE')}
                  disabled={blockedByComment || decide.isPending}
                >
                  <ThumbsUp size={16} /> Aprobar
                </button>
              </div>
            </>
          ) : (
            <Alert tone="info">
              {gate.reason ?? 'Esta solicitud no admite decisiones desde tu sesión.'}
            </Alert>
          )}
        </Panel>
      ) : null}

      {confirming && openRequest && gate ? (
        <DecisionConfirmDialog
          decision={confirming}
          subject={{
            requestLabel,
            artifactName: display(artifact, 'name'),
            artifactCode: display(artifact, 'artifactCode'),
            versionLabel: display(reviewVersion, 'semanticVersion', 'versionNumber'),
            requiredRole: gate.requiredRole,
            stepLabel: `Paso ${display(asRecord(gate.step), 'stepOrder')}`,
          }}
          gates={gates}
          comments={comments}
          pending={decide.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={confirmDecision}
        />
      ) : null}

      <SecurityDetails review={review} />
    </>
  );
}
