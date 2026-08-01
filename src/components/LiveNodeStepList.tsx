import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { nodeTypeDefinition } from '../features/graph-editor/node-catalog';
import { EmptyState } from './EmptyState';

export interface LiveNodeStep {
  status: 'RUNNING' | 'COMPLETED' | 'ERROR';
  nodeKey: string;
  nodeType: string;
  branchTaken?: string;
  discardedEdgeKeys?: string[];
  errorMessage?: string;
}

const ICONS = { RUNNING: Loader2, COMPLETED: CheckCircle2, ERROR: XCircle };
const STATUS_LABEL = { RUNNING: 'En ejecución', COMPLETED: 'Completado', ERROR: 'Con error' };

/**
 * Progreso nodo por nodo de una ejecución en vivo (Fase 8).
 *
 * Cada paso se dibuja con el mismo icono y la misma etiqueta que su nodo en el
 * lienzo —ambos leen de `node-catalog`—, de modo que quien diseñó el algoritmo
 * reconoce aquí exactamente los mismos bloques. El estado se comunica con
 * icono, texto y color a la vez, nunca sólo con color, y la lista se anuncia
 * como región educada para que un lector de pantalla siga el avance real.
 */
export function LiveNodeStepList({ steps }: { steps: LiveNodeStep[] }) {
  if (!steps.length) {
    return (
      <EmptyState
        illustration="graph"
        title="Sin ejecución en curso"
        description="Aquí se irá dibujando, paso a paso, el recorrido que hace el motor por el algoritmo mientras decide."
        example="Configura el artefacto y las variables a la izquierda y pulsa «Iniciar ejecución en vivo»."
      />
    );
  }
  return (
    <ol className="live-node-steps" aria-live="polite">
      {steps.map((step, index) => {
        const Icon = ICONS[step.status];
        const definition = nodeTypeDefinition(step.nodeType);
        const NodeIcon = definition.icon;
        return (
          <li
            key={index}
            className={`live-node-step live-node-${step.status.toLowerCase()}`}
            title={`${definition.label}: ${definition.description}`}
          >
            <Icon
              size={16}
              className={step.status === 'RUNNING' ? 'spin' : undefined}
              aria-hidden="true"
            />
            <span className="live-node-key">
              <NodeIcon size={13} aria-hidden="true" /> {step.nodeKey}
            </span>
            <span className="muted-text">
              {definition.label} · {STATUS_LABEL[step.status]}
            </span>
            {step.branchTaken ? (
              <span className="dependency-node-key">→ {step.branchTaken}</span>
            ) : null}
            {step.discardedEdgeKeys?.length ? (
              <span className="live-node-discarded">
                descartadas: {step.discardedEdgeKeys.join(', ')}
              </span>
            ) : null}
            {step.errorMessage ? (
              <span className="live-node-error">{step.errorMessage}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
