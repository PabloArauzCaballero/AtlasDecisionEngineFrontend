import { useEffect, useId, useRef } from 'react';
import type { DragEvent, KeyboardEvent, PointerEvent } from 'react';
import { clamp } from '../../utils/numbers';
import type { UnknownRecord } from '../../utils/records';
import { display } from '../../utils/records';
import { NODE_HEIGHT, NODE_WIDTH, positionOf, worldSize } from './canvas-world';
import type { ConnectionNotice } from './connection-feedback';
import { GraphEdges } from './GraphEdges';
import { GraphNodeCard } from './GraphNodeCard';
import { nodeIo } from './node-io';
import { nodeBadges, nodeSummary } from './node-summary';
import { CanvasLegend } from './CanvasLegend';
import { CanvasOverlays } from './CanvasOverlays';
import type { CanvasZoom } from '../graph-view/useCanvasZoom';

interface GraphCanvasProps {
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  /** Catálogos del grafo: permiten decir qué lee y qué escribe cada nodo. */
  conditions?: UnknownRecord[];
  actions?: UnknownRecord[];
  variables?: UnknownRecord[];
  /** Muestra el lienzo en estado de carga mientras llega el grafo. */
  loading?: boolean;
  /** Modo detallado: cada nodo enseña su regla y sus marcas, y cada conexión su
   * condición; se apaga para recuperar la vista de conjunto en grafos grandes. */
  detailed?: boolean;
  selectedKey?: string;
  selectedEdgeKey?: string;
  pendingFrom?: string | null;
  connectMode: boolean;
  connectionNotice?: ConnectionNotice | null;
  /** Escala compartida: el lienzo la aplica y le presta su ventana desplazable. */
  zoom: CanvasZoom;
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
  conditions = [],
  actions = [],
  variables = [],
  loading = false,
  detailed = true,
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
  const worldRef = useRef<HTMLDivElement>(null);
  const dragKey = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const markerId = `graph-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const world = worldSize(nodes.map((node, index) => positionOf(node, index)));
  const nodeWidth = (NODE_WIDTH / world.width) * 100;
  const nodeHeight = (NODE_HEIGHT / world.height) * 100;
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
  const catalogs = { conditions, actions, variables };
  const rulesByNode = Object.fromEntries(
    placed.map((item) => [item.key, nodeSummary(item.node, catalogs)]),
  );

  function toPercent(clientX: number, clientY: number, includeDragOffset = false) {
    const rect = worldRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
    const offsetX = includeDragOffset ? dragOffset.current.x : 0;
    const offsetY = includeDragOffset ? dragOffset.current.y : 0;
    // El rect del mundo ya viene desplazado por el scroll y escalado por el zoom:
    // basta la posición relativa para que soltar caiga donde toca.
    return {
      x: clamp(((clientX - offsetX - rect.left) / rect.width) * 100, 0, maxNodeX),
      y: clamp(((clientY - offsetY - rect.top) / rect.height) * 100, 0, maxNodeY),
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

  // Un nodo seleccionado desde fuera del lienzo (checklist, búsqueda) puede caer
  // fuera de pantalla: se trae a la vista sin mover el resto de la página.
  useEffect(() => {
    if (!selectedKey) return;
    const element = worldRef.current?.querySelector('.graph-node.selected');
    if (element instanceof HTMLElement && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }
  }, [selectedKey]);

  return (
    <div
      className={[
        'graph-canvas',
        connectMode ? 'is-connecting' : '',
        detailed ? 'is-detailed' : 'is-compact',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={`graph-canvas-viewport ${zoom.panning ? 'is-panning' : ''}`.trim()}
        ref={zoom.viewportRef}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handleDrop}
        /*
          `role` + `tabIndex` van juntos y no son decoración. Un `aria-label` en un
          elemento SIN rol lo descarta la especificación, así que el lienzo no se
          anunciaba; y la caja desplazaba en los dos ejes sin ser enfocable, con lo
          que un nodo fuera de vista no se alcanzaba con teclado (WCAG 2.1.1).

          El rol es `group` y NO `application`: `application` le dice al lector de
          pantalla que ceda TODAS las pulsaciones a la página, y eso apaga el modo
          lectura para los nodos de dentro —que son botones y se navegan solos—. Se
          reserva para widgets que implementan su teclado entero, y aquí el
          desplazamiento con flechas lo hace el navegador sobre un contenedor
          enfocable. `group` da el nombre accesible sin quitar nada.
        */
        role="group"
        tabIndex={0}
        aria-label="Lienzo del algoritmo de decisión. Con las flechas se recorre; con Tab se salta de nodo en nodo."
      >
        {/* Reserva el espacio del mundo ya escalado para que el contenedor genere
            barras de desplazamiento horizontal y vertical de verdad. */}
        <div
          className="graph-canvas-scroll"
          style={{ width: world.width * zoom.zoom, height: world.height * zoom.zoom }}
        >
          <div
            className="graph-canvas-world"
            ref={worldRef}
            style={{
              width: world.width,
              height: world.height,
              transform: `scale(${zoom.zoom})`,
            }}
          >
            <div className="canvas-grid" />
            <GraphEdges
              edges={edges}
              nodesByKey={byKey}
              selectedEdgeKey={selectedEdgeKey}
              nodeWidth={nodeWidth}
              nodeHeight={nodeHeight}
              markerId={markerId}
              rulesByNode={detailed ? rulesByNode : undefined}
              onEdgeClick={onEdgeClick}
            />
            {placed.map(({ node, key, x, y }) => (
              <GraphNodeCard
                key={key}
                name={display(node, 'label', 'key')}
                type={display(node, 'type')}
                selected={selectedKey === key}
                connectSource={pendingFrom === key}
                terminal={Boolean(node.terminal)}
                // Variables, no conexiones: ésas ya se dibujan; lo que no se veía
                // era qué datos entran y salen de cada paso.
                io={nodeIo(node, catalogs)}
                summary={detailed ? nodeSummary(node, catalogs) : null}
                badges={detailed ? nodeBadges(node, catalogs) : undefined}
                style={{ left: `${x}%`, top: `${y}%` }}
                onPointerDown={(event) => handlePointerDown(event, key)}
                onPointerMove={handlePointerMove}
                onPointerUp={() => finishPointer(node)}
                onPointerCancel={() => finishPointer()}
                onKeyDown={(event) => handleNodeKeyDown(event, node)}
              />
            ))}
          </div>
        </div>
      </div>
      <CanvasOverlays
        connectMode={connectMode}
        connectionNotice={connectionNotice}
        pendingFrom={pendingFrom}
        loading={loading}
        isEmpty={!nodes.length}
        onCancelConnection={onCancelConnection}
        onAddStart={onAddStart}
      />
      <CanvasLegend />
    </div>
  );
}
