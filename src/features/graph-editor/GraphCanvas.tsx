import { useRef } from 'react';
import type { DragEvent, PointerEvent } from 'react';
import { Square } from 'lucide-react';
import type { UnknownRecord } from '../../utils/records';
import { display } from '../../utils/records';
import { icons } from './node-types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function positionOf(node: UnknownRecord, index: number) {
  const fallbackX = 10 + (index % 3) * 30;
  const fallbackY = 14 + Math.floor(index / 3) * 29;
  return {
    x: clamp(typeof node.x === 'number' ? node.x : fallbackX, 0, 96),
    y: clamp(typeof node.y === 'number' ? node.y : fallbackY, 0, 92),
  };
}

interface GraphCanvasProps {
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  selectedKey?: string;
  selectedEdgeKey?: string;
  pendingFrom?: string | null;
  zoom: number;
  onNodeClick: (node: UnknownRecord) => void;
  onMoveNode: (key: string, x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropNode: (type: string, x: number, y: number) => void;
  onEdgeClick: (key: string) => void;
}

export function GraphCanvas({
  nodes,
  edges,
  selectedKey,
  selectedEdgeKey,
  pendingFrom,
  zoom,
  onNodeClick,
  onMoveNode,
  onDragStart,
  onDragEnd,
  onDropNode,
  onEdgeClick,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragKey = useRef<string | null>(null);
  const moved = useRef(false);

  const placed = nodes.map((node, index) => ({
    node,
    key: display(node, 'key'),
    ...positionOf(node, index),
  }));
  const byKey = new Map(placed.map((item) => [item.key, item]));

  function toPercent(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 96),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 92),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, key: string) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragKey.current = key;
    moved.current = false;
    onDragStart();
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!dragKey.current) return;
    moved.current = true;
    const { x, y } = toPercent(event.clientX, event.clientY);
    onMoveNode(dragKey.current, x, y);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>, node: UnknownRecord) {
    const wasDrag = moved.current;
    dragKey.current = null;
    moved.current = false;
    onDragEnd();
    if (!wasDrag) onNodeClick(node);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/x-node-type');
    if (!type) return;
    const { x, y } = toPercent(event.clientX, event.clientY);
    onDropNode(type, x, y);
  }

  return (
    <div
      className="graph-canvas"
      ref={canvasRef}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="canvas-grid" />
      <div className="graph-canvas-zoom" style={{ transform: `scale(${zoom})` }}>
        {placed.map(({ node, key, x, y }) => {
          const type = display(node, 'type') as keyof typeof icons;
          const Icon = icons[type] ?? Square;
          return (
            <button
              key={key}
              type="button"
              className={[
                'graph-node',
                `node-${type.toLowerCase()}`,
                selectedKey === key ? 'selected' : '',
                pendingFrom === key ? 'connect-source' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: `${x}%`, top: `${y}%` }}
              onPointerDown={(event) => handlePointerDown(event, key)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => handlePointerUp(event, node)}
            >
              <Icon size={17} />
              <span>
                <strong>{display(node, 'label', 'key')}</strong>
                <small>{type}</small>
              </span>
            </button>
          );
        })}
        <svg className="graph-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
          {edges.map((edge) => {
            const from = byKey.get(display(edge, 'from'));
            const to = byKey.get(display(edge, 'to'));
            const edgeKey = display(edge, 'key');
            if (!from || !to) return null;
            const x1 = from.x + 8;
            const y1 = from.y + 4;
            const x2 = to.x + 8;
            const y2 = to.y + 4;
            return (
              <path
                key={edgeKey}
                role="button"
                tabIndex={0}
                aria-label={`Editar conexión ${edgeKey}`}
                className={selectedEdgeKey === edgeKey ? 'selected' : ''}
                d={`M ${x1} ${y1} L ${x2} ${y2}`}
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
            );
          })}
        </svg>
      </div>
    </div>
  );
}
