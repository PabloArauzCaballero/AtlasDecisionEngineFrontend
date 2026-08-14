'use client';

import { useEffect, useId } from 'react';
import { display, type UnknownRecord } from '../../utils/records';
import { NODE_HEIGHT, NODE_WIDTH, positionOf, worldSize } from '../graph-editor/canvas-world';
import { normalizeNodePositions } from '../graph-editor/graph-layout';
import { GraphEdges } from '../graph-editor/GraphEdges';
import { GraphNodeCard } from '../graph-editor/GraphNodeCard';
import type { EdgeRuntimeMap, NodeRuntimeMap } from '../graph-editor/node-runtime';
import { useCanvasZoom } from '../graph-view/useCanvasZoom';
import { ZoomControls } from '../graph-view/ZoomControls';

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
  nodes: stored,
  edges,
  runtime,
  edgeRuntime,
  activeKey,
  onSelectNode,
}: PlaybackGraphProps) {
  const markerId = `playback-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  /*
   * Mismo acomodo que en el editor. Un grafo creado por API llega con todos los
   * nodos en `(0, 0)`, y aquí no hay forma de separarlos arrastrando: la
   * reproducción se vería como una sola tarjeta en la esquina con el recorrido
   * escondido debajo.
   */
  const nodes = normalizeNodePositions(stored, edges);
  const world = worldSize(nodes.map((node, index) => positionOf(node, index)));
  const nodeWidth = (NODE_WIDTH / world.width) * 100;
  const nodeHeight = (NODE_HEIGHT / world.height) * 100;
  // El mundo es del tamaño que dice `worldSize`, así que se declara en vez de medirse:
  // «Ajustar» puede calcular la escala exacta sin esperar a que el DOM se estabilice.
  const zoom = useCanvasZoom({ content: world });
  const viewport = zoom.viewportRef;

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
  }, [activeKey, viewport]);

  return (
    <div className="graph-canvas playback-canvas">
      <ZoomControls zoom={zoom} label="Escala del recorrido" />
      <div
        className={`graph-canvas-viewport ${zoom.panning ? 'is-panning' : ''}`.trim()}
        ref={viewport}
        /* Igual que el lienzo del editor: sin rol, el `aria-label` se descarta, y
           sin `tabIndex` la caja desplaza pero no se alcanza con teclado. */
        role="group"
        tabIndex={0}
        aria-label="Recorrido de la ejecución. Usa las flechas para recorrerlo."
      >
        <div
          className="graph-canvas-scroll"
          style={{ width: world.width * zoom.zoom, height: world.height * zoom.zoom }}
        >
          <div
            className="graph-canvas-world"
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
