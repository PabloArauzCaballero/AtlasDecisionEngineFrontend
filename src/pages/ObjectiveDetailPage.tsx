'use client';

import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { POLICY_ARTIFACT_LINK_ROLES, POLICY_TEST_LINK_ROLES } from '../auth/business-rules';
import { hasAnyRole } from '../auth/roles';
import { useEffectiveRoles } from '../auth/useAuth';
import { Alert } from '../components/Alert';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { statusText } from '../contracts/status-labels';
import { PolicyEvidenceDialog } from '../features/objectives/PolicyEvidenceDialog';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';
import { ScrollRegion } from '../components/ScrollRegion';

interface ObjectiveDetailPageProps {
  objectiveId: string;
}

/** El porcentaje declarado, o `null` si no hay uno medible (nunca un valor de relleno). */
function percentOf(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function ObjectiveDetailPage({ objectiveId }: ObjectiveDetailPageProps) {
  const query = useDetailQuery<unknown>(
    'objective-detail',
    objectiveId ? `/v1/traceability/objectives/${encodeURIComponent(objectiveId)}` : null,
  );
  const objective = asRecord(query.data);
  const policies = asRows(objective.policyRequirements);
  const target = asRecord(objective.targetJson);
  const objectiveStatus = statusText(objective.status);
  const roles = useEffectiveRoles();
  const canLinkArtifact = hasAnyRole(roles, POLICY_ARTIFACT_LINK_ROLES);
  const canLinkTest = hasAnyRole(roles, POLICY_TEST_LINK_ROLES);
  const [linking, setLinking] = useState<{ id: string; code: string } | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Trazabilidad"
        title={display(objective, 'name')}
        description={display(objective, 'objectiveCode')}
      />
      {query.isError ? <Alert tone="error">No fue posible cargar el objetivo.</Alert> : null}
      <div className="objective-layout">
        <Panel title="Ficha del objetivo" meta={objectiveStatus}>
          <DefinitionGrid
            record={objective}
            items={[
              { label: 'Código', keys: ['objectiveCode'], mono: true },
              { label: 'Métrica', keys: ['metric'] },
              { label: 'Equipo responsable', keys: ['ownerTeam'] },
              { label: 'Creado', keys: ['createdAt'] },
            ]}
          />
        </Panel>
        {/* Antes, sin dato, las barras marcaban 42 % y 78 %: cifras inventadas que parecían
            medidas. Sin porcentaje real no se dibuja barra; se dice que falta. */}
        <Panel title="Métricas clave (actual y meta)">
          <div className="target-metrics">
            <div>
              <span>Actual</span>
              <strong>{display(target, 'current', 'actual')}</strong>
              {percentOf(target.currentPct) === null ? (
                <small>Todavía no hay una medición registrada.</small>
              ) : (
                <ProgressBar value={percentOf(target.currentPct) ?? 0} label="Valor actual" />
              )}
            </div>
            <div>
              <span>Meta</span>
              <strong>{display(target, 'target', 'value')}</strong>
              {percentOf(target.targetPct) === null ? (
                <small>La meta no tiene un porcentaje declarado.</small>
              ) : (
                <ProgressBar value={percentOf(target.targetPct) ?? 0} label="Meta" tone="warning" />
              )}
            </div>
          </div>
        </Panel>
      </div>
      <div className="objective-layout">
        <Panel title="Políticas regulatorias asociadas" meta={`${policies.length} políticas`}>
          <div className="policy-list">
            {policies.map((policy) => (
              <article key={display(policy, 'id')}>
                <div>
                  <strong>{display(policy, 'policyCode')}</strong>
                  <p>{display(policy, 'rationale')}</p>
                </div>
                <StatusBadge value={policy.severity} />
              </article>
            ))}
          </div>
        </Panel>
        <Panel title="Matriz de implementación" meta="Con enlaces a la evidencia">
          <ScrollRegion label="Cobertura del objetivo" data-tutorial-id="objective-matrix">
            <table>
              <thead>
                <tr>
                  <th scope="col">Política</th>
                  <th scope="col">Algoritmos</th>
                  <th scope="col">Suites</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => {
                  const artifactLinks = asRows(policy.artifactLinks);
                  const testLinks = asRows(policy.testLinks);
                  const code = display(policy, 'policyCode');
                  return (
                    <tr key={display(policy, 'id')}>
                      <td className="mono">{code}</td>
                      <td>{artifactLinks.length}</td>
                      <td>{testLinks.length}</td>
                      <td>
                        <StatusBadge
                          value={artifactLinks.length && testLinks.length ? 'COMPLETE' : 'GAP'}
                        />
                      </td>
                      <td>
                        <button
                          className="button"
                          type="button"
                          disabled={!canLinkArtifact && !canLinkTest}
                          title={
                            canLinkArtifact || canLinkTest
                              ? `Vincular evidencia a ${code}`
                              : 'Requiere el rol de cumplimiento, analista de riesgo o analista de calidad'
                          }
                          onClick={() => setLinking({ id: display(policy, 'id'), code })}
                        >
                          <Link2 size={16} /> Vincular
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollRegion>
        </Panel>
      </div>
      {linking ? (
        <PolicyEvidenceDialog
          policyId={linking.id}
          policyCode={linking.code}
          canLinkArtifact={canLinkArtifact}
          canLinkTest={canLinkTest}
          onClose={() => setLinking(null)}
        />
      ) : null}
    </>
  );
}
