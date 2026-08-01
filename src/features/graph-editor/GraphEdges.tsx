import type { UnknownRecord } from '../../utils/records';
import { display } from '../../utils/records';
import { detailedEdgeLabel, edgeLabel, edgeTooltip } from './edge-explanations';
import type { EdgeRuntimeMap } from './node-runtime';

export interface PlacedGraphNode {
  node: UnknownRecord;
  key: string;
  x: number;
  y: number;
}

interface GraphEdgesProps {
  edges: UnknownRecord[];
  nodesByKey: Map<string, PlacedGraphNode>;
  selectedEdgeKey?: string;
  nodeWidth: number;
  nodeHeight: number;
  markerId: string;
  onEdgeClick: (key: string) => void;
  /** Caminos tomados y descartados de una ejecución real. */
  edgeRuntime?: EdgeRuntimeMap;
  /**
   * Resumen de la regla del nodo de origen, por clave de nodo. Con él, la
   * etiqueta de la flecha dice `si score_buro ≥ 700` en lugar de sólo `Sí`.
   */
  rulesByNode?: Record<string, string | null>;
}

export function GraphEdges({
  edges,
  nodesByKey,
  selectedEdgeKey,
  nodeWidth,
  nodeHeight,
  markerId,
  onEdgeClick,
  edgeRuntime,
  rulesByNode,
}: GraphEdgesProps) {
  return (
    <>
      <svg className="graph-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker
            id={markerId}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
            viewBox="0 0 7 7"
          >
            <path d="M 0 0 L 7 3.5 L 0 7 z" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const from = nodesByKey.get(display(edge, 'from'));
          const to = nodesByKey.get(display(edge, 'to'));
          const edgeKey = display(edge, 'key');
          if (!from || !to) return null;
          const path = edgePath(from, to, nodeWidth, nodeHeight);
          const status = edgeRuntime?.[edgeKey];
          const tooltip = edgeTooltip(edge, display(from.node, 'type'), status);
          return (
            <g
              key={edgeKey}
              className={[
                selectedEdgeKey === edgeKey ? 'selected' : '',
                status ? `edge-${status}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <path className="graph-edge-hit" d={path} onClick={() => onEdgeClick(edgeKey)} />
              <path
                role="button"
                tabIndex={0}
                aria-label={`Conexión ${edgeKey}. ${tooltip.replace(/\n/g, ' ')}`}
                className="graph-edge-line"
                d={path}
                markerEnd={`url(#${markerId})`}
                onClick={() => onEdgeClick(edgeKey)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onEdgeClick(edgeKey);
                  }
                }}
              >
                <title>{tooltip}</title>
              </path>
              {/* Sólo el camino realmente recorrido lleva el trazo animado: la
                  animación indica flujo, nunca decora una rama descartada. */}
              {status === 'taken' ? <path className="graph-edge-flow" d={path} /> : null}
            </g>
          );
        })}
      </svg>
      {edges.map((edge) => {
        const from = nodesByKey.get(display(edge, 'from'));
        const to = nodesByKey.get(display(edge, 'to'));
        if (!from || !to) return null;
        const sourceType = display(from.node, 'type');
        const key = display(edge, 'key');
        const status = edgeRuntime?.[key];
        return (
          <button
            key={`label-${key}`}
            type="button"
            title={edgeTooltip(edge, sourceType, status)}
            className={[
              'graph-edge-label',
              selectedEdgeKey === key ? 'selected' : '',
              status ? `edge-${status}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left: `${(from.x + to.x + nodeWidth) / 2}%`,
              top: `${(from.y + to.y + nodeHeight) / 2}%`,
            }}
            onClick={() => onEdgeClick(key)}
          >
            {rulesByNode
              ? detailedEdgeLabel(edge, sourceType, rulesByNode[display(edge, 'from')] ?? null)
              : edgeLabel(edge, sourceType)}
          </button>
        );
      })}
    </>
  );
}

function edgePath(
  from: PlacedGraphNode,
  to: PlacedGraphNode,
  nodeWidth: number,
  nodeHeight: number,
): string {
  const forward = to.x >= from.x;
  const x1 = forward ? from.x + nodeWidth : from.x;
  const x2 = forward ? to.x : to.x + nodeWidth;
  const y1 = from.y + nodeHeight / 2;
  const y2 = to.y + nodeHeight / 2;
  const direction = forward ? 1 : -1;
  const bend = Math.max(7, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + direction * bend} ${y1}, ${x2 - direction * bend} ${y2}, ${x2} ${y2}`;
}
