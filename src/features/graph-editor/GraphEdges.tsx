import type { UnknownRecord } from '../../utils/records';
import { display } from '../../utils/records';

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
}

export function GraphEdges({
  edges,
  nodesByKey,
  selectedEdgeKey,
  nodeWidth,
  nodeHeight,
  markerId,
  onEdgeClick,
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
          return (
            <g key={edgeKey} className={selectedEdgeKey === edgeKey ? 'selected' : ''}>
              <path className="graph-edge-hit" d={path} onClick={() => onEdgeClick(edgeKey)} />
              <path
                role="button"
                tabIndex={0}
                aria-label={`Editar conexión ${edgeKey}`}
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
                <title>Editar conexión {edgeKey}</title>
              </path>
            </g>
          );
        })}
      </svg>
      {edges.map((edge) => {
        const from = nodesByKey.get(display(edge, 'from'));
        const to = nodesByKey.get(display(edge, 'to'));
        if (!from || !to) return null;
        const sourceType = display(from.node, 'type');
        let label = 'Continuar';
        if (sourceType === 'CONDITION') label = edge.default ? 'No / defecto' : 'Sí';
        else if (sourceType === 'SWITCH') label = edge.default ? 'Defecto' : 'Caso';
        return (
          <button
            key={`label-${display(edge, 'key')}`}
            type="button"
            className={`graph-edge-label ${selectedEdgeKey === display(edge, 'key') ? 'selected' : ''}`}
            style={{
              left: `${(from.x + to.x + nodeWidth) / 2}%`,
              top: `${(from.y + to.y + nodeHeight) / 2}%`,
            }}
            onClick={() => onEdgeClick(display(edge, 'key'))}
          >
            {label}
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
