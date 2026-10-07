import { GitBranch, History, Pencil, TerminalSquare, Workflow } from 'lucide-react';
import Link from 'next/link';
import { Alert } from '../components/Alert';
import { CONCEPTS } from '../components/concept-icons';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { PageHeader } from '../components/PageHeader';
import { DataInspector } from '../components/DataInspector';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { Tabs } from '../components/Tabs';
import { useTabParam } from '../components/useTabParam';
import { NewVersionButton } from '../features/algorithms/NewVersionButton';
import { isEditableVersionStatus } from '../features/algorithms/new-version';
import { EnvironmentHeadsPanel } from '../features/governance/EnvironmentHeadsPanel';
import { VersionDiffPanel } from '../features/governance/VersionDiffPanel';
import { VersionHistoryGraph } from '../features/version-history/VersionHistoryGraph';
import type { VersionRow } from '../features/version-history/VersionHistoryGraph';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';

function toVersionRow(version: Record<string, unknown>): VersionRow {
  const parent = display(version, 'sourceVersionId');
  return {
    id: display(version, 'id'),
    parentId: parent && parent !== '—' ? parent : null,
    label: display(version, 'semanticVersion', 'versionNumber'),
    status: version.status,
    createdAt: display(version, 'createdAt'),
    createdBy: display(version, 'createdBy'),
    changeSummary: display(version, 'changeSummary'),
  };
}

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
  const latestVersion = display(latest, 'semanticVersion', 'versionNumber');
  // «Editar borrador» sólo tiene sentido si la última versión TODAVÍA es un borrador. Antes se ofrecía siempre y,
  // sobre una versión aprobada o desplegada, el editor abría algo que el motor ya no deja guardar.
  const latestEditable = isEditableVersionStatus(latest.status);
  const tabIds = ['summary', 'versions', 'data'] as const;
  const [activeTab, setActiveTab] = useTabParam(tabIds, 'summary');

  return (
    <>
      <PageHeader
        eyebrow="Diseño · Algoritmo"
        title={display(artifact, 'name', 'artifactCode')}
        description={display(artifact, 'description')}
        actions={
          <>
            {latestId !== '—' ? (
              <Link className="button" href={`/artifact-versions/${latestId}/graph`}>
                <GitBranch size={16} /> Ver diagrama
              </Link>
            ) : null}
            <Link className="button" href={`/artifacts/${artifactId}/dependency-graph`}>
              <Workflow size={16} /> Dependencias
            </Link>
            {latestId !== '—' && latestEditable ? (
              <Link
                className="button button-primary"
                href={`/graph-editor?versionId=${encodeURIComponent(latestId)}`}
              >
                <Pencil size={16} /> Editar borrador
              </Link>
            ) : latestId !== '—' ? (
              <NewVersionButton
                variant="primary"
                sourceVersionId={latestId}
                sourceVersion={latestVersion}
                algorithmName={display(artifact, 'name', 'artifactCode')}
              />
            ) : (
              <button
                className="button button-primary"
                type="button"
                disabled
                title="Este algoritmo todavía no tiene versiones. Crea una desde «Algoritmos y versiones»."
              >
                <Pencil size={16} /> Editar borrador
              </button>
            )}
          </>
        }
      />
      {query.isError ? (
        <Alert tone="error">
          No fue posible cargar el algoritmo. Actualiza la página; si sigue, avisa a soporte.
        </Alert>
      ) : null}
      <Tabs
        tabs={[
          {
            id: 'summary',
            label: 'Resumen',
            icon: CONCEPTS.artifact.icon,
            hint: 'Qué decide este artefacto y cómo está configurado.',
          },
          {
            id: 'versions',
            label: 'Versiones',
            count: versions.length,
            icon: CONCEPTS.version.icon,
            hint: 'Cada versión es una fotografía inmutable del algoritmo.',
          },
          {
            id: 'data',
            label: 'Datos',
            icon: CONCEPTS.variableCatalog.icon,
            hint: 'Todos los datos guardados de este algoritmo, tal como los tiene el motor.',
          },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        idPrefix="artifact"
      >
        {(tab) =>
          tab === 'summary' ? (
            <div className="artifact-overview">
              <Panel title="Ficha" meta={display(artifact, 'artifactCode')}>
                <DefinitionGrid
                  record={artifact}
                  items={[
                    { label: 'Código', keys: ['artifactCode', 'code'], mono: true },
                    { label: 'Tipo', keys: ['artifactType', 'type'] },
                    { label: 'Equipo responsable', keys: ['ownerTeam'] },
                    { label: 'Dominio de riesgo', keys: ['riskDomain'] },
                    { label: 'Creado', keys: ['createdAt'] },
                    { label: 'Activo', keys: ['isActive'] },
                  ]}
                />
              </Panel>
              <EnvironmentHeadsPanel artifactCode={artifactCode} />
              {/*
               * «Última versión» es la más reciente del historial, no la que
               * está decidiendo: eso lo dice el panel de ambientes de arriba.
               * Llamarla «Current Version · Governed» hacía creer que una
               * versión recién creada ya mandaba en producción.
               */}
              <Panel title="Última versión del historial" meta="Puede no estar desplegada">
                <div className="current-version">
                  <strong>v{display(latest, 'semanticVersion', 'versionNumber')}</strong>
                  <StatusBadge value={latest.status} />
                  {/* El motor lo llama `canonicalChecksum` (Prisma
                      `decision_artifact_version.canonical_checksum`); pedir
                      `checksum` a secas dejaba siempre un guión. */}
                  <p className="mono">{display(latest, 'canonicalChecksum', 'checksum')}</p>
                </div>
                {latestId !== '—' && !latestEditable ? (
                  <p className="muted-text">
                    Esta versión ya no se edita. Para cambiar el algoritmo, crea una{' '}
                    <strong>versión nueva</strong>: parte de ésta como borrador y vuelve a pasar por
                    validación, pruebas, dos firmas y despliegue.
                  </p>
                ) : null}
                <div className="stack-actions">
                  {latestId !== '—' ? (
                    <NewVersionButton
                      sourceVersionId={latestId}
                      sourceVersion={latestVersion}
                      algorithmName={display(artifact, 'name', 'artifactCode')}
                      label={latestEditable ? 'Otra versión desde ésta' : 'Nueva versión'}
                    />
                  ) : null}
                  {previousId !== '—' ? (
                    <Link
                      className="button"
                      href={`/reviews?versionId=${encodeURIComponent(previousId)}`}
                      title="Enviar la versión anterior al flujo de aprobación"
                    >
                      <History size={16} /> Volver a la versión anterior
                    </Link>
                  ) : (
                    <button
                      className="button"
                      type="button"
                      disabled
                      title="No hay una versión anterior a la cual volver"
                    >
                      <History size={16} /> Volver a la versión anterior
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
                    <TerminalSquare size={16} /> Ver sus decisiones
                  </Link>
                </div>
              </Panel>
            </div>
          ) : tab === 'versions' ? (
            <>
              <Panel title="Historial de versiones" meta={`${versions.length} versiones`}>
                <VersionHistoryGraph versions={versions.map(toVersionRow)} />
              </Panel>
              {/* Qué introdujo la última versión respecto de la anterior: el
                  lineaje dice cuáles hay, no qué cambió en cada una. */}
              {latestId !== '—' && previousId !== '—' ? (
                <VersionDiffPanel
                  targetVersionId={latestId}
                  targetLabel={`v${display(latest, 'semanticVersion', 'versionNumber')}`}
                  bases={[
                    {
                      versionId: previousId,
                      label: `v${display(versions[1] ?? {}, 'semanticVersion', 'versionNumber')}`,
                      hint: 'versión anterior',
                    },
                  ]}
                />
              ) : null}
            </>
          ) : (
            <Panel title="Datos del algoritmo" meta="Tal como los guarda el motor">
              <DataInspector data={artifact} idPrefix="artifact-data" label="Algoritmo" />
            </Panel>
          )
        }
      </Tabs>
    </>
  );
}
