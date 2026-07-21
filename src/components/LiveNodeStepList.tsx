import { CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react';

export interface LiveNodeStep {
  status: 'RUNNING' | 'COMPLETED' | 'ERROR';
  nodeKey: string;
  nodeType: string;
  branchTaken?: string;
  discardedEdgeKeys?: string[];
  errorMessage?: string;
}

const ICONS = { RUNNING: Loader2, COMPLETED: CheckCircle2, ERROR: XCircle };

/** Fase 8 — animated node-by-node live execution status list. */
export function LiveNodeStepList({ steps }: { steps: LiveNodeStep[] }) {
  if (!steps.length) {
    return (
      <div className="empty-state">
        <CircleDashed size={16} /> Sin ejecución en curso.
      </div>
    );
  }
  return (
    <ol className="live-node-steps">
      {steps.map((step, index) => {
        const Icon = ICONS[step.status];
        return (
          <li key={index} className={`live-node-step live-node-${step.status.toLowerCase()}`}>
            <Icon
              size={16}
              className={step.status === 'RUNNING' ? 'spin' : undefined}
              aria-hidden="true"
            />
            <span className="live-node-key">{step.nodeKey}</span>
            <span className="muted-text">{step.nodeType}</span>
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
