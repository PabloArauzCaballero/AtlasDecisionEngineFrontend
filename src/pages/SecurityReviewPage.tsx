import { useMutation } from '@tanstack/react-query';
import { Download, GitBranch, ShieldAlert, ThumbsDown, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { SeverityBadge } from '../components/SeverityBadge';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';

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
  const review = asRecord(query.data);
  const artifact = asRecord(review.artifact);
  const findings = asRows(review.findings);
  const code = asRows(review.code);
  const variables = asRows(review.variables);
  const nestedTrees = asRecord(review.nestedTrees);
  const dependsOn = asRows(nestedTrees.dependsOn);
  const dependedOnBy = asRows(nestedTrees.dependedOnBy);
  const governance = asRows(review.governance);
  const incidents = asRows(review.incidents);
  const pendingStep = governance
    .flatMap((request) => asRows(request.steps))
    .find((step) => step.status === 'PENDING');
  const pendingStepId = pendingStep ? display(pendingStep, 'id') : null;

  const decide = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES') =>
      apiRequest(`/v1/approval-steps/${encodeURIComponent(pendingStepId ?? '')}/decisions`, {
        method: 'POST',
        body: { decision, comments, evidence: [] },
      }),
    onSuccess: () => query.refetch(),
  });

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
        eyebrow="F10 · Security Review"
        title={
          display(artifact, 'name', 'artifactCode') === '—'
            ? 'Revisión de seguridad'
            : display(artifact, 'name')
        }
        description={`${display(artifact, 'artifactCode')} · v${display(review.version ? asRecord(review.version) : {}, 'semanticVersion', 'versionNumber')}`}
        actions={
          <>
            <SeverityBadge value={review.severity} />
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

      <Panel title="Hallazgos" meta={`${findings.length}`}>
        {findings.length ? (
          <ul className="dependency-list">
            {findings.map((finding, index) => (
              <li key={index}>
                <ShieldAlert size={14} aria-hidden="true" />
                <SeverityBadge value={finding.severity} />
                {display(finding, 'message')}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">Sin hallazgos de riesgo.</div>
        )}
      </Panel>

      <div className="code-import-layout">
        <Panel title="Código" meta={`${code.length} nodos de script`}>
          {code.length ? (
            code.map((script, index) => (
              <pre key={index} className="security-code-excerpt">
                {display(script, 'nodeKey')} · {display(script, 'language')}
                {'\n'}
                {display(script, 'sourceExcerpt')}
              </pre>
            ))
          ) : (
            <div className="empty-state">Esta versión no ejecuta nodos de script.</div>
          )}
        </Panel>
        <Panel title="Variables" meta={`${variables.length}`}>
          <ul className="dependency-list">
            {variables.map((variable, index) => (
              <li key={index}>
                <span className="dependency-node-key">{display(variable, 'usageType')}</span>
                {display(variable, 'code')} ({display(variable, 'dataClassification')}
                {variable.isSensitive ? ', sensible' : ''})
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Subárboles"
        meta={`${dependsOn.length} referencias · ${dependedOnBy.length} dependientes`}
      >
        <ul className="dependency-list">
          {dependsOn.map((reference, index) => (
            <li key={`dep-${index}`}>
              <GitBranch size={14} aria-hidden="true" />
              Depende de artefacto {display(reference, 'childArtifactId')} (
              {display(reference, 'nodeKey')})
            </li>
          ))}
          {dependedOnBy.map((reference, index) => (
            <li key={`ref-${index}`}>
              <GitBranch size={14} aria-hidden="true" />
              Referenciado por versión {display(reference, 'parentArtifactVersionId')}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Incidentes" meta={`${incidents.length}`}>
        {incidents.length ? (
          <ul className="dependency-list">
            {incidents.map((incident, index) => (
              <li key={index}>
                {display(incident, 'eventType')} · {display(incident, 'occurredAt')} ·{' '}
                <Link href={`/artifacts/${display(incident, 'artifactId')}`}>Ver artefacto</Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">Sin incidentes registrados para esta versión.</div>
        )}
      </Panel>

      {pendingStepId ? (
        <Panel title="Decisión de seguridad" meta={`Paso #${pendingStepId}`}>
          <label className="field">
            <span>Comentarios</span>
            <textarea
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              rows={3}
            />
          </label>
          <div className="inline-actions">
            <button
              className="button"
              type="button"
              onClick={() => decide.mutate('REQUEST_CHANGES')}
              disabled={decide.isPending}
            >
              Solicitar cambios
            </button>
            <button
              className="button"
              type="button"
              onClick={() => decide.mutate('REJECT')}
              disabled={decide.isPending}
            >
              <ThumbsDown size={16} /> Rechazar
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => decide.mutate('APPROVE')}
              disabled={decide.isPending}
            >
              <ThumbsUp size={16} /> Aprobar
            </button>
          </div>
          {decide.isError ? <Alert tone="error">{errorMessage(decide.error)}</Alert> : null}
        </Panel>
      ) : null}
    </>
  );
}
