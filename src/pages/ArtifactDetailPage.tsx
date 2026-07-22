import { GitBranch, History, Pencil, TerminalSquare, Workflow } from 'lucide-react';
import Link from 'next/link';
import { Alert } from '../components/Alert';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';

interface ArtifactDetailPageProps {
  artifactId: string;
}

export function ArtifactDetailPage({ artifactId }: ArtifactDetailPageProps) {
  const query = useDetailQuery<unknown>(
    'artifact-detail',
    artifactId ? `/v1/artifacts/${encodeURIComponent(artifactId)}` : null,
  );
  const artifact = asRecord(query.data);
  const versions = asRows(artifact.versions);
  const latest = versions[0] ?? {};
  const latestId = display(latest, 'id');
  // Rollback is a governed action: it routes to the review flow prefilled with
  // the previous version instead of mutating anything directly.
  const previousId = display(versions[1] ?? {}, 'id');
  const artifactCode = display(artifact, 'artifactCode', 'code');

  return (
    <>
      <PageHeader
        eyebrow="F2-03 · Artifact Detail"
        title={display(artifact, 'name', 'artifactCode')}
        description={display(artifact, 'description')}
        actions={
          <>
            {latestId !== '—' ? (
              <Link className="button" href={`/artifact-versions/${latestId}/graph`}>
                <GitBranch size={16} /> View Graph
              </Link>
            ) : null}
            <Link className="button" href={`/artifacts/${artifactId}/dependency-graph`}>
              <Workflow size={16} /> Dependency Graph
            </Link>
            {latestId !== '—' ? (
              <Link
                className="button button-primary"
                href={`/graph-editor?versionId=${encodeURIComponent(latestId)}`}
              >
                <Pencil size={16} /> Edit Draft
              </Link>
            ) : (
              <button className="button button-primary" type="button" disabled>
                <Pencil size={16} /> Edit Draft
              </button>
            )}
          </>
        }
      />
      {query.isError ? (
        <Alert tone="error">No fue posible cargar el artefacto solicitado.</Alert>
      ) : null}
      <div className="artifact-overview">
        <Panel title="Metadata" meta={display(artifact, 'artifactCode')}>
          <DefinitionGrid
            record={artifact}
            items={[
              { label: 'Artifact Code', keys: ['artifactCode', 'code'], mono: true },
              { label: 'Type', keys: ['artifactType', 'type'] },
              { label: 'Owner Team', keys: ['ownerTeam'] },
              { label: 'Risk Domain', keys: ['riskDomain'] },
              { label: 'Created At', keys: ['createdAt'] },
              { label: 'Active', keys: ['isActive'] },
            ]}
          />
        </Panel>
        <Panel title="Current Version" meta="Governed">
          <div className="current-version">
            <strong>v{display(latest, 'semanticVersion', 'versionNumber')}</strong>
            <StatusBadge value={latest.status} />
            <p className="mono">{display(latest, 'checksum')}</p>
          </div>
          <div className="stack-actions">
            {previousId !== '—' ? (
              <Link
                className="button"
                href={`/reviews?versionId=${encodeURIComponent(previousId)}`}
                title="Enviar la versión anterior al flujo de aprobación"
              >
                <History size={16} /> Rollback
              </Link>
            ) : (
              <button
                className="button"
                type="button"
                disabled
                title="No hay una versión anterior a la cual volver"
              >
                <History size={16} /> Rollback
              </button>
            )}
            <Link
              className="button"
              href={
                artifactCode !== '—'
                  ? `/executions?filter=${encodeURIComponent(artifactCode)}`
                  : '/executions'
              }
            >
              <TerminalSquare size={16} /> Execution Logs
            </Link>
          </div>
        </Panel>
      </div>
      <Panel title="Version History" meta={`${versions.length} versions`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Status</th>
                <th>Checksum</th>
                <th>Created</th>
                <th>Author</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => {
                const versionId = display(version, 'id');
                return (
                  <tr key={versionId}>
                    <td className="mono">
                      v{display(version, 'semanticVersion', 'versionNumber')}
                    </td>
                    <td>
                      <StatusBadge value={version.status} />
                    </td>
                    <td className="mono">{display(version, 'checksum')}</td>
                    <td>{display(version, 'createdAt')}</td>
                    <td>{display(version, 'createdBy')}</td>
                    <td>
                      <div className="inline-actions">
                        <Link href={`/artifact-versions/${versionId}/graph`}>Graph</Link>
                        <Link href={`/artifact-versions/${versionId}/compile`}>Compile</Link>
                        <Link href={`/artifact-versions/${versionId}/test-suites`}>Tests</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
