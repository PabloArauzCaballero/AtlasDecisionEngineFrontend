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
import { PolicyEvidenceDialog } from '../features/objectives/PolicyEvidenceDialog';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';
import { ScrollRegion } from '../components/ScrollRegion';

interface ObjectiveDetailPageProps {
  objectiveId: string;
}

export function ObjectiveDetailPage({ objectiveId }: ObjectiveDetailPageProps) {
  const query = useDetailQuery<unknown>(
    'objective-detail',
    objectiveId ? `/v1/traceability/objectives/${encodeURIComponent(objectiveId)}` : null,
  );
  const objective = asRecord(query.data);
  const policies = asRows(objective.policyRequirements);
  const target = asRecord(objective.targetJson);
  const roles = useEffectiveRoles();
  const canLinkArtifact = hasAnyRole(roles, POLICY_ARTIFACT_LINK_ROLES);
  const canLinkTest = hasAnyRole(roles, POLICY_TEST_LINK_ROLES);
  const [linking, setLinking] = useState<{ id: string; code: string } | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="F7-03 · Business Traceability"
        title={display(objective, 'name')}
        description={display(objective, 'objectiveCode')}
      />
      {query.isError ? <Alert tone="error">No fue posible cargar el objetivo.</Alert> : null}
      <div className="objective-layout">
        <Panel title="Metadata del Objetivo" meta={display(objective, 'status')}>
          <DefinitionGrid
            record={objective}
            items={[
              { label: 'Código', keys: ['objectiveCode'], mono: true },
              { label: 'Métrica', keys: ['metric'] },
              { label: 'Owner Team', keys: ['ownerTeam'] },
              { label: 'Creado', keys: ['createdAt'] },
            ]}
          />
        </Panel>
        <Panel title="Métricas Clave (Actual vs Target)" meta="Live">
          <div className="target-metrics">
            <div>
              <span>Actual</span>
              <strong>{display(target, 'current', 'actual')}</strong>
              <ProgressBar value={Number(target.currentPct ?? 42)} label="Valor actual" />
            </div>
            <div>
              <span>Target</span>
              <strong>{display(target, 'target', 'value')}</strong>
              <ProgressBar value={Number(target.targetPct ?? 78)} label="Objetivo" tone="warning" />
            </div>
          </div>
        </Panel>
      </div>
      <div className="objective-layout">
        <Panel title="Políticas Regulatorias Asociadas" meta={`${policies.length} policies`}>
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
        <Panel title="Matriz de Implementación" meta="Evidence links">
          <ScrollRegion label="Cobertura del objetivo" data-tutorial-id="objective-matrix">
            <table>
              <thead>
                <tr>
                  <th scope="col">Política</th>
                  <th scope="col">Artefactos</th>
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
                              : 'Requiere el rol Compliance, Riesgo o QA'
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
