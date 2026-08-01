'use client';

import { useEffect, useId, useRef } from 'react';
import { display, type UnknownRecord } from '../../utils/records';
import { NODE_HEIGHT, NODE_WIDTH, positionOf, worldSize } from '../graph-editor/canvas-world';
import { GraphEdges } from '../graph-editor/GraphEdges';
import { GraphNodeCard } from '../graph-editor/GraphNodeCard';
import type { EdgeRuntimeMap, NodeRuntimeMap } from '../graph-editor/node-runtime';

interface PlaybackGraphProps {
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  runtime: NodeRuntimeMap;
  edgeRuntime: EdgeRuntimeMap;
  /** Nodo del paso actual: se resalta y se trae a la vista. */
  activeKey: string;
  onSelectNode: (nodeKey: string) => void;
}

/**
 * Grafo de sólo lectura sobre el que se reproduce una ejecución.
 *
 * Comparte tarjeta (`GraphNodeCard`), geometría (`canvas-world`) y aristas
 * (`GraphEdges`) con el editor, así que un nodo se ve igual mientras se diseña
 * y mientras se audita. Lo que cambia es que aquí no se arrastra nada: pulsar
 * un nodo abre su detalle.
 */
export function PlaybackGraph({
  nodes,
  edges,
  runtime,
  edgeRuntime,
  activeKey,
  onSelectNode,
}: PlaybackGraphProps) {
  const markerId = `playback-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const world = worldSize(nodes.map((node, index) => positionOf(node, index)));
  const nodeWidth = (NODE_WIDTH / world.width) * 100;
  const nodeHeight = (NODE_HEIGHT / world.height) * 100;
  const viewport = useRef<HTMLDivElement>(null);

  const placed = nodes.map((node, index) => {
    const position = positionOf(node, index);
    return { node, key: display(node, 'key'), x: position.x, y: position.y };
  });
  const byKey = new Map(placed.map((item) => [item.key, item]));

  // El mundo es mayor que la ventana: sin esto, el paso que falló podría estar
  // fuera de pantalla y el usuario vería una reproducción "que no hace nada".
  useEffect(() => {
    if (!activeKey) return;
    const element = viewport.current?.querySelector('.graph-node.selected');
    if (element instanceof HTMLElement && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }
  }, [activeKey]);

  return (
    <div className="graph-canvas playback-canvas">
      <div className="graph-canvas-viewport" ref={viewport} aria-label="Recorrido de la ejecución">
        <div className="graph-canvas-scroll" style={{ width: world.width, height: world.height }}>
          <div className="graph-canvas-world" style={{ width: world.width, height: world.height }}>
            <div className="canvas-grid" />
            <GraphEdges
              edges={edges}
              nodesByKey={byKey}
              nodeWidth={nodeWidth}
              nodeHeight={nodeHeight}
              markerId={markerId}
              edgeRuntime={edgeRuntime}
              onEdgeClick={() => {}}
            />
            {placed.map(({ node, key, x, y }) => (
              <GraphNodeCard
                key={key}
                name={display(node, 'label', 'key')}
                type={display(node, 'type')}
                terminal={Boolean(node.terminal)}
                runtime={runtime[key]}
                selected={activeKey === key}
                style={{ left: `${x}%`, top: `${y}%`, cursor: 'pointer' }}
                onClick={() => onSelectNode(key)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
