import { Link2, TestTube2 } from 'lucide-react';
import { Alert } from '../components/Alert';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';

interface ObjectiveDetailPageProps {
  objectiveId: string;
}

export function ObjectiveDetailPage({ objectiveId }: ObjectiveDetailPageProps) {
  const query = useDetailQuery<unknown>(
    'objective-detail',
    objectiveId
      ? `/v1/traceability/objectives/${encodeURIComponent(objectiveId)}`
      : null,
  );
  const objective = asRecord(query.data);
  const policies = asRows(objective.policyRequirements);
  const target = asRecord(objective.targetJson);

  return (
    <>
      <PageHeader
        eyebrow="F7-03 · Business Traceability"
        title={display(objective, 'name')}
        description={display(objective, 'objectiveCode')}
        actions={
          <>
            <button className="button" type="button">
              <TestTube2 size={16} /> Vincular Prueba
            </button>
            <button className="button button-primary" type="button">
              <Link2 size={16} /> Vincular Versión
            </button>
          </>
        }
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
              <ProgressBar value={Number(target.currentPct ?? 42)} />
            </div>
            <div>
              <span>Target</span>
              <strong>{display(target, 'target', 'value')}</strong>
              <ProgressBar value={Number(target.targetPct ?? 78)} tone="warning" />
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Política</th>
                  <th>Artefactos</th>
                  <th>Suites</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => {
                  const artifactLinks = asRows(policy.artifactLinks);
                  const testLinks = asRows(policy.testLinks);
                  return (
                    <tr key={display(policy, 'id')}>
                      <td className="mono">{display(policy, 'policyCode')}</td>
                      <td>{artifactLinks.length}</td>
                      <td>{testLinks.length}</td>
                      <td>
                        <StatusBadge
                          value={artifactLinks.length && testLinks.length ? 'COVERED' : 'GAP'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
