'use client';

import { GitCompare, Printer, Share2, ShieldAlert, ThumbsDown, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../auth/useAuth';
import { isPassingGate } from '../features/governance/approval-gates';
import { useVersionGates } from '../features/governance/useVersionGates';
import { DecisionConfirmDialog } from '../features/governance/DecisionConfirmDialog';
import { evaluateDecisionGate } from '../features/governance/decision-policy';
import { buildDiffBases } from '../features/governance/diff-bases';
import { useApprovalDecision, type Decision } from '../features/governance/useApprovalDecision';
import { useArtifactHeads } from '../features/governance/useArtifactHeads';
import { VersionDiffPanel } from '../features/governance/VersionDiffPanel';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { useNotifications } from '../notifications/useNotifications';
import { asRecord, asRows, display } from '../utils/records';

interface ApprovalRequestDetailPageProps {
  requestId: string;
}

export function ApprovalRequestDetailPage({ requestId }: ApprovalRequestDetailPageProps) {
  const [comments, setComments] = useState('');
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const { notify } = useNotifications();
  const { user } = useAuth();
  const query = useDetailQuery<unknown>(
    'approval-request',
    requestId ? `/v1/approval-requests/${encodeURIComponent(requestId)}` : null,
  );
  const request = asRecord(query.data);
  const version = asRecord(request.artifactVersion);
  const artifact = asRecord(version.artifact);
  const steps = asRows(request.steps);

  const gate = evaluateDecisionGate(request, user);
  const { gates, loading: gatesLoading, deniedEvidence } = useVersionGates(request, version);
  const { heads } = useArtifactHeads(display(artifact, 'artifactCode'));
  const requestLabel = `REQ-${display(request, 'id')}`;
  const decide = useApprovalDecision({
    requestLabel,
    refresh: () => void query.refetch(),
  });

  /** Abre la confirmación y fija la clave de idempotencia de este intento. */
  const askConfirmation = (decision: Decision) => {
    decide.beginAttempt();
    setConfirming(decision);
  };

  const confirmDecision = () => {
    if (!gate.stepId || !confirming) return;
    decide.mutate(
      { stepId: gate.stepId, decision: confirming, comments },
      {
        onSuccess: () => {
          // Limpiar evita que el comentario se replique sobre un paso posterior.
          setComments('');
          setConfirming(null);
        },
        onError: () => setConfirming(null),
      },
    );
  };

  /** Copia el enlace directo de la solicitud para pegarlo en chat o correo. */
  const shareRequest = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify({
        tone: 'success',
        title: 'Enlace copiado',
        description: `El enlace directo a ${requestLabel} está en tu portapapeles.`,
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

  const versionLabel = display(version, 'semanticVersion', 'versionNumber');
  const versionId = display(version, 'id');
  const blockedByComment = !comments.trim();

  // Contra qué comparar esta versión: su origen y lo vigente en cada ambiente.
  // La misma consulta que usa la ficha del artefacto, resuelta una sola vez.
  const sourceVersionId = display(version, 'sourceVersionId');
  const { bases, movedAhead } = buildDiffBases({
    versionId,
    sourceVersionId: sourceVersionId === '—' ? null : sourceVersionId,
    heads,
  });

  return (
    <>
      <PageHeader
        eyebrow="F4-03 · Governance Request"
        title={`${requestLabel}: ${display(artifact, 'name')}`}
        description={`${display(artifact, 'artifactCode')} · v${versionLabel}`}
        actions={
          <>
            <Link className="button" href={`/security-review/${versionId}`}>
              <ShieldAlert size={16} /> Revisión de Seguridad
            </Link>
            <button className="button" type="button" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir
            </button>
            <button className="button" type="button" onClick={() => void shareRequest()}>
              <Share2 size={16} /> Compartir
            </button>
          </>
        }
      />
      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}
      {decide.staleState ? (
        <Alert tone="warning">
          La solicitud cambió mientras la revisabas: otra persona decidió este paso o el flujo
          avanzó. Se releyó el estado real; revísalo antes de volver a decidir.
        </Alert>
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
          <Panel
            title="Resultados de Pruebas (Gates)"
            meta={
              gatesLoading
                ? 'Leyendo evidencia…'
                : gates.reported
                  ? `${gates.rows.length} reportados`
                  : 'Sin datos del backend'
            }
          >
            {gates.reported ? (
              <ul className="gate-list">
                {gates.rows.map((row) => (
                  <li key={row.key} data-passing={isPassingGate(row.status) ? 'yes' : 'no'}>
                    <span>
                      {row.label}
                      {row.detail ? <small>{row.detail}</small> : null}
                    </span>
                    <StatusBadge value={row.status ?? 'SIN DATO'} />
                  </li>
                ))}
              </ul>
            ) : gatesLoading ? (
              <p className="muted-text">Consultando las suites y corridas de esta versión…</p>
            ) : (
              <Alert tone="warning">
                {deniedEvidence
                  ? 'Tu rol no puede leer las suites de prueba de esta versión, así que esta pantalla no tiene con qué respaldar la compilación ni las corridas bloqueantes. Pídeselo a QA o revísalo en la versión antes de firmar.'
                  : 'Esta versión no tiene suites de prueba ni compilación registradas, y la solicitud no trae resultados de gates. Esta pantalla no puede afirmar que la compilación, las suites bloqueantes o la cobertura hayan pasado: compruébalo en la versión antes de firmar.'}
              </Alert>
            )}
          </Panel>
          {movedAhead.length ? (
            <Alert tone="warning">
              Esta versión partió de otra distinta de la que hoy está vigente en{' '}
              {movedAhead.map((head) => head.environmentCode).join(', ')}: el objetivo avanzó
              mientras esperaba revisión. Compárala contra lo vigente antes de firmar — aprobarla
              puede revertir lo que ya está decidiendo.
            </Alert>
          ) : null}
          <VersionDiffPanel
            targetVersionId={versionId === '—' ? '' : versionId}
            targetLabel={`v${versionLabel}`}
            bases={bases}
          />
          {versionId !== '—' ? (
            <div className="stack-actions">
              <Link className="button" href={`/artifact-versions/${versionId}/graph`}>
                <GitCompare size={16} /> Ver grafo completo de la versión
              </Link>
            </div>
          ) : null}
        </main>
        <aside>
          <Panel title="Decisión de Aprobación" meta={gate.requiredRole ?? 'Sin rol declarado'}>
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
            {gate.canDecide ? (
              <>
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
                    disabled={blockedByComment || decide.isPending}
                    onClick={() => askConfirmation('REJECT')}
                    type="button"
                  >
                    <ThumbsDown size={16} /> Rechazar
                  </button>
                  <button
                    className="button button-primary"
                    disabled={blockedByComment || decide.isPending}
                    onClick={() => askConfirmation('APPROVE')}
                    type="button"
                  >
                    <ThumbsUp size={16} /> Aprobar Despliegue
                  </button>
                </div>
              </>
            ) : (
              <Alert tone="info">
                {gate.reason ?? 'Esta solicitud no admite decisiones desde tu sesión.'}
              </Alert>
            )}
          </Panel>
        </aside>
      </div>
      {confirming ? (
        <DecisionConfirmDialog
          decision={confirming}
          subject={{
            requestLabel,
            artifactName: display(artifact, 'name'),
            artifactCode: display(artifact, 'artifactCode'),
            versionLabel,
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
    </>
  );
}
