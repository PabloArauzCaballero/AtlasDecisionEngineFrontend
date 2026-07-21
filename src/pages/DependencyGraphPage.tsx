import { GitBranch } from 'lucide-react';
import Link from 'next/link';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';

interface DependencyGraphPageProps {
  artifactId: string;
}

interface GraphNode {
  artifactId: string;
  artifactCode: string;
  name: string;
}

interface GraphEdge {
  parentArtifactId: string;
  parentArtifactVersionId: string;
  childArtifactId: string;
  childArtifactVersionId: string;
  nodeKey: string;
}

/**
 * Nested decision trees (Fase 7): visualizes which artifacts this one references
 * (its dependencies) and which artifacts reference it (its dependents), with
 * navigation to each referenced artifact. Data comes from
 * GET /v1/artifacts/{artifactId}/dependency-graph (see docs/nested-decision-trees.md).
 */
export function DependencyGraphPage({ artifactId }: DependencyGraphPageProps) {
  const query = useDetailQuery<unknown>(
    'artifact-dependency-graph',
    artifactId ? `/v1/artifacts/${encodeURIComponent(artifactId)}/dependency-graph` : null,
  );
  const graph = asRecord(query.data);
  const nodes = asRows(graph.nodes) as unknown as GraphNode[];
  const edges = asRows(graph.edges) as unknown as GraphEdge[];
  const nodeById = new Map(nodes.map((node) => [node.artifactId, node]));

  const dependencies = edges.filter((edge) => edge.parentArtifactId === artifactId);
  const dependents = edges.filter((edge) => edge.childArtifactId === artifactId);

  return (
    <>
      <PageHeader
        eyebrow="F7 · Nested Decision Trees"
        title="Dependency graph"
        description="Árboles de decisión referenciados por este artefacto, y artefactos que lo referencian a él."
      />
      {query.isError ? (
        <Alert tone="error">No fue posible cargar el grafo de dependencias.</Alert>
      ) : null}
      <div className="dependency-graph-columns">
        <Panel title="Depende de (referencias salientes)" meta={String(dependencies.length)}>
          {dependencies.length ? (
            <ul className="dependency-list">
              {dependencies.map((edge) => {
                const child = nodeById.get(edge.childArtifactId);
                return (
                  <li key={`${edge.parentArtifactVersionId}-${edge.nodeKey}`}>
                    <GitBranch size={14} aria-hidden="true" />
                    <span className="dependency-node-key">{edge.nodeKey}</span>
                    <Link href={`/artifacts/${edge.childArtifactId}`}>
                      {child ? `${child.name} (${child.artifactCode})` : edge.childArtifactId}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-state">
              Este artefacto no referencia ningún otro árbol de decisión.
            </div>
          )}
        </Panel>

        <Panel
          title="Este artefacto"
          meta={display(asRecord(nodeById.get(artifactId)), 'artifactCode')}
        >
          <p>{display(asRecord(nodeById.get(artifactId)), 'name')}</p>
          <p className="muted-text">Profundidad máxima configurada: {display(graph, 'maxDepth')}</p>
        </Panel>

        <Panel title="Referenciado por (dependientes)" meta={String(dependents.length)}>
          {dependents.length ? (
            <ul className="dependency-list">
              {dependents.map((edge) => {
                const parent = nodeById.get(edge.parentArtifactId);
                return (
                  <li key={`${edge.parentArtifactVersionId}-${edge.nodeKey}`}>
                    <GitBranch size={14} aria-hidden="true" />
                    <span className="dependency-node-key">{edge.nodeKey}</span>
                    <Link href={`/artifacts/${edge.parentArtifactId}`}>
                      {parent ? `${parent.name} (${parent.artifactCode})` : edge.parentArtifactId}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-state">
              Ningún otro artefacto referencia a este árbol de decisión.
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
