'use client';

import { AlertTriangle, Check, CircleDashed, Loader2, MinusCircle } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { display, type UnknownRecord } from '../../utils/records';
import { edgeRuntimeAt, runtimeAt, type TraceStep } from './execution-trace';
import { PlaybackControls } from './PlaybackControls';
import { PlaybackGraph } from './PlaybackGraph';
import { StepDetail } from './StepDetail';
import { useExecutionPlayback } from './useExecutionPlayback';

interface ExecutionPlaybackProps {
  steps: TraceStep[];
  /** Nodos y aristas de la versión ejecutada; vacío mientras el grafo carga. */
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  /** Resultado esperado, si la vista lo conoce (caso de prueba). */
  expected?: unknown;
}

const TIMELINE_ICONS = {
  pending: CircleDashed,
  running: Loader2,
  done: Check,
  skipped: MinusCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
} as const;

/**
 * Modo de reproducción de una ejecución.
 *
 * Recorre paso a paso la traza real que devolvió el backend sobre el grafo de
 * la versión ejecutada: se ve el camino seguido, los caminos descartados, dónde
 * intervino una persona, qué algoritmo interno se invocó y en qué nodo falló.
 * Si la ejecución no trae traza no se dibuja nada — no hay recorrido que
 * simular.
 */
export function ExecutionPlayback({ steps, nodes, edges, expected }: ExecutionPlaybackProps) {
  const playback = useExecutionPlayback(steps.length);

  if (!steps.length) {
    return (
      <EmptyState
        illustration="empty"
        title="Esta ejecución no registró un recorrido paso a paso"
        description="La reproducción necesita la trazabilidad que el motor guarda nodo por nodo. Las ejecuciones antiguas, o las resueltas antes de activar la traza, sólo conservan su entrada y su resultado."
        example="Puedes clonar la transacción al simulador para volver a ejecutarla y obtener una traza completa."
      />
    );
  }

  const current = steps[Math.min(playback.cursor, steps.length - 1)];
  const nodeKeys = nodes.map((node) => display(node, 'key'));
  const runtime = runtimeAt(steps, playback.cursor, nodeKeys);
  const edgeRuntime = edgeRuntimeAt(steps, playback.cursor, edges);

  const selectNode = (nodeKey: string) => {
    const match = steps.filter((step) => step.nodeKey === nodeKey).at(-1);
    if (match) playback.goTo(match.index);
  };

  return (
    <div className="playback">
      <PlaybackControls playback={playback} total={steps.length} currentLabel={current.nodeKey} />

      <div className="playback-stage">
        {nodes.length ? (
          <PlaybackGraph
            nodes={nodes}
            edges={edges}
            runtime={runtime}
            edgeRuntime={edgeRuntime}
            activeKey={current.nodeKey}
            onSelectNode={selectNode}
          />
        ) : (
          <p className="playback-no-graph">
            No se pudo cargar el grafo de la versión ejecutada. La línea de tiempo de abajo sigue
            mostrando el recorrido real, paso a paso.
          </p>
        )}
      </div>

      <ol className="playback-timeline" aria-label="Línea de tiempo de la ejecución">
        {steps.map((step) => {
          const state = step.index === playback.cursor ? 'current' : '';
          const Icon = TIMELINE_ICONS[step.status];
          return (
            <li key={step.index}>
              <button
                type="button"
                className={`playback-event run-${step.status} ${state}`}
                aria-current={step.index === playback.cursor ? 'step' : undefined}
                title={`Ir al paso ${step.index + 1}: ${step.nodeKey}`}
                onClick={() => playback.goTo(step.index)}
              >
                <Icon size={13} aria-hidden="true" />
                <span>{step.nodeKey}</span>
                {step.durationMs !== undefined ? <b>{step.durationMs} ms</b> : null}
              </button>
            </li>
          );
        })}
      </ol>

      <StepDetail step={current} expected={expected} />
    </div>
  );
}
