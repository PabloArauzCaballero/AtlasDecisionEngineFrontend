import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent, PointerEvent } from 'react';
import { Link2, MousePointer2, Plus, Square, X } from 'lucide-react';
import type { UnknownRecord } from '../../utils/records';
import { display } from '../../utils/records';
import type { ConnectionNotice } from './connection-feedback';
import { GraphEdges } from './GraphEdges';
import { icons } from './node-types';

const NODE_WIDTH = 182;
const NODE_HEIGHT = 66;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function positionOf(node: UnknownRecord, index: number) {
  const fallbackX = 8 + (index % 3) * 29;
  const fallbackY = 12 + Math.floor(index / 3) * 27;
  return {
    x: clamp(typeof node.x === 'number' ? node.x : fallbackX, 0, 96),
    y: clamp(typeof node.y === 'number' ? node.y : fallbackY, 0, 96),
  };
}

interface GraphCanvasProps {
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  selectedKey?: string;
  selectedEdgeKey?: string;
  pendingFrom?: string | null;
  connectMode: boolean;
  connectionNotice?: ConnectionNotice | null;
  zoom: number;
  onNodeClick: (node: UnknownRecord) => void;
  onMoveNode: (key: string, x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: (changed?: boolean) => void;
  onDropNode: (type: string, x: number, y: number) => void;
  onEdgeClick: (key: string) => void;
  onCancelConnection: () => void;
  onAddStart: () => void;
}

export function GraphCanvas({
  nodes,
  edges,
  selectedKey,
  selectedEdgeKey,
  pendingFrom,
  connectMode,
  connectionNotice,
  zoom,
  onNodeClick,
  onMoveNode,
  onDragStart,
  onDragEnd,
  onDropNode,
  onEdgeClick,
  onCancelConnection,
  onAddStart,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragKey = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 650 });
  const markerId = `graph-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) setCanvasSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const nodeWidth = (NODE_WIDTH / canvasSize.width) * 100;
  const nodeHeight = (NODE_HEIGHT / canvasSize.height) * 100;
  const maxNodeX = Math.max(0, 99 - nodeWidth);
  const maxNodeY = Math.max(0, 99 - nodeHeight);
  const placed = nodes.map((node, index) => {
    const position = positionOf(node, index);
    return {
      node,
      key: display(node, 'key'),
      x: clamp(position.x, 0, maxNodeX),
      y: clamp(position.y, 0, maxNodeY),
    };
  });
  const byKey = new Map(placed.map((item) => [item.key, item]));

  function toPercent(clientX: number, clientY: number, includeDragOffset = false) {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return { x: 0, y: 0 };
    const offsetX = includeDragOffset ? dragOffset.current.x : 0;
    const offsetY = includeDragOffset ? dragOffset.current.y : 0;
    // The canvas is scrollable: getBoundingClientRect gives the visible viewport
    // origin, so add the internal scroll offset to land in the scaled content space.
    const contentX = clientX - rect.left + canvas.scrollLeft - offsetX;
    const contentY = clientY - rect.top + canvas.scrollTop - offsetY;
    return {
      x: clamp((contentX / (rect.width * zoom)) * 100, 0, maxNodeX),
      y: clamp((contentY / (rect.height * zoom)) * 100, 0, maxNodeY),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, key: string) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const nodeRect = event.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - nodeRect.left, y: event.clientY - nodeRect.top };
    dragKey.current = key;
    moved.current = false;
    onDragStart();
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!dragKey.current) return;
    moved.current = true;
    const { x, y } = toPercent(event.clientX, event.clientY, true);
    onMoveNode(dragKey.current, x, y);
  }

  function finishPointer(node?: UnknownRecord) {
    const wasDrag = moved.current;
    dragKey.current = null;
    moved.current = false;
    onDragEnd(wasDrag);
    if (!wasDrag && node) onNodeClick(node);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/x-node-type');
    if (!type) return;
    const { x, y } = toPercent(event.clientX, event.clientY);
    onDropNode(type, x, y);
  }

  function handleNodeKeyDown(event: KeyboardEvent<HTMLButtonElement>, node: UnknownRecord) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onNodeClick(node);
      return;
    }
    const key = display(node, 'key');
    const current = byKey.get(key);
    if (!current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 4 : 1;
    const nextX =
      current.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0);
    const nextY =
      current.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0);
    onDragStart();
    onMoveNode(key, clamp(nextX, 0, maxNodeX), clamp(nextY, 0, maxNodeY));
    onDragEnd(true);
  }

  return (
    <div
      className={`graph-canvas ${connectMode ? 'is-connecting' : ''}`}
      ref={canvasRef}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDrop}
      aria-label="Lienzo del algoritmo de decisión"
    >
      <div className="canvas-grid" />
      {connectMode ? (
        <div
          className={`canvas-connection-guide notice-${connectionNotice?.tone ?? 'info'}`}
          role="status"
        >
          <span className="canvas-connection-icon">
            <Link2 size={15} />
          </span>
          <span>
            <strong>{pendingFrom ? 'Elige el destino' : 'Modo conexión activo'}</strong>
            <small>
              {connectionNotice?.text ??
                'Selecciona primero el nodo de origen y después el nodo de destino.'}
            </small>
          </span>
          {pendingFrom ? (
            <button type="button" onClick={onCancelConnection} aria-label="Cancelar conexión">
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}
      {!nodes.length ? (
        <div className="canvas-empty-state">
          <span>
            <MousePointer2 size={22} />
          </span>
          <strong>Empieza a diseñar tu algoritmo</strong>
          <p>Agrega el nodo inicial y construye el flujo de izquierda a derecha.</p>
          <button className="button button-primary" type="button" onClick={onAddStart}>
            <Plus size={16} /> Agregar inicio
          </button>
        </div>
      ) : null}
      <div className="graph-canvas-zoom" style={{ transform: `scale(${zoom})` }}>
        <GraphEdges
          edges={edges}
          nodesByKey={byKey}
          selectedEdgeKey={selectedEdgeKey}
          nodeWidth={nodeWidth}
          nodeHeight={nodeHeight}
          markerId={markerId}
          onEdgeClick={onEdgeClick}
        />
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
              aria-label={`${display(node, 'label', 'key')}, nodo ${type}`}
              onPointerDown={(event) => handlePointerDown(event, key)}
              onPointerMove={handlePointerMove}
              onPointerUp={() => finishPointer(node)}
              onPointerCancel={() => finishPointer()}
              onKeyDown={(event) => handleNodeKeyDown(event, node)}
            >
              <span className="graph-node-port graph-node-port-input" aria-hidden="true" />
              <span className="graph-node-icon">
                <Icon size={18} />
              </span>
              <span className="graph-node-copy">
                <strong>{display(node, 'label', 'key')}</strong>
                <small>{nodeTypeLabel(type)}</small>
              </span>
              {!node.terminal ? (
                <span className="graph-node-port graph-node-port-output" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="canvas-legend" aria-hidden="true">
        <span>
          <i className="legend-condition" /> Condición
        </span>
        <span>
          <i className="legend-result" /> Resultado
        </span>
        <span>
          <i className="legend-terminal" /> Terminal
        </span>
      </div>
    </div>
  );
}

function nodeTypeLabel(type: keyof typeof icons): string {
  const labels: Partial<Record<keyof typeof icons, string>> = {
    START: 'Inicio',
    CONDITION: 'Condición',
    MANUAL_REVIEW: 'Revisión manual',
    RESULT: 'Resultado',
    END: 'Fin del flujo',
  };
  return labels[type] ?? String(type).replace(/_/g, ' ');
}
