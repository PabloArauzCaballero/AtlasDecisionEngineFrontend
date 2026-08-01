'use client';

import type { LiveNodeStep } from '../../components/LiveNodeStepList';
import { EmptyState } from '../../components/EmptyState';
import { display, type UnknownRecord } from '../../utils/records';
import { edgeRuntimeAt, runtimeAt } from './execution-trace';
import { liveTrace } from './live-trace';
import { PlaybackGraph } from './PlaybackGraph';

interface LiveGraphProps {
  events: LiveNodeStep[];
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  /** `true` mientras el motor sigue enviando eventos. */
  running: boolean;
}

/**
 * Grafo de una ejecución en vivo.
 *
 * Es el mismo lienzo de la reproducción, alimentado por los eventos SSE en
 * lugar de por una traza guardada: el nodo activo late, el camino recorrido se
 * dibuja y los descartados se atenúan a medida que el motor avanza de verdad.
 *
 * Mientras la ejecución sigue en curso, los nodos que aún no se han visitado se
 * pintan como pendientes y no como omitidos: todavía pueden ejecutarse, y
 * anticiparlo sería afirmar algo que no ha ocurrido.
 */
export function LiveGraph({ events, nodes, edges, running }: LiveGraphProps) {
  if (!nodes.length) {
    return (
      <EmptyState
        illustration="graph"
        title="Elige la versión para ver el recorrido"
        description="Con la versión del algoritmo seleccionada, el motor va iluminando aquí cada nodo que evalúa, en tiempo real."
        example="Si no la eliges, abajo sigue apareciendo el detalle paso a paso en forma de lista."
      />
    );
  }

  const steps = liveTrace(events);
  const cursor = Math.max(0, steps.length - 1);
  const nodeKeys = nodes.map((node) => display(node, 'key'));
  const runtime = runtimeAt(steps, cursor, nodeKeys, { completed: !running && steps.length > 0 });
  const edgeRuntime = edgeRuntimeAt(steps, cursor, edges);

  return (
    <PlaybackGraph
      nodes={nodes}
      edges={edges}
      runtime={runtime}
      edgeRuntime={edgeRuntime}
      activeKey={steps[cursor]?.nodeKey ?? ''}
      onSelectNode={() => {}}
    />
  );
}
