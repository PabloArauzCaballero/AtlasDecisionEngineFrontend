import { Clock, CornerDownRight, Network, ShieldAlert, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { JsonPanel } from '../../components/JsonPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { nodeTypeDefinition } from '../graph-editor/node-catalog';
import { runStatusLabel } from '../graph-editor/node-runtime';
import type { TraceStep } from './execution-trace';

interface StepDetailProps {
  step: TraceStep;
  /** Resultado esperado del caso, cuando la vista lo conoce (pruebas). */
  expected?: unknown;
}

/**
 * Panel explicativo del paso seleccionado.
 *
 * Responde, para un único nodo, a las preguntas que el grafo sólo puede
 * insinuar: qué recibió, qué devolvió, cuánto tardó, por dónde continuó, si
 * llamó a otro algoritmo y si alguien tuvo que intervenir.
 */
export function StepDetail({ step, expected }: StepDetailProps) {
  const definition = nodeTypeDefinition(step.nodeType);
  const Icon = definition.icon;

  return (
    <div className="playback-detail">
      <header>
        <span className={`playback-detail-icon node-${step.nodeType.toLowerCase()}`}>
          <Icon size={18} />
        </span>
        <div>
          <strong>{step.nodeKey}</strong>
          <small>{definition.label}</small>
        </div>
        <StatusBadge value={runStatusLabel(step.status)} />
      </header>

      <p className="playback-detail-what">{definition.description}</p>
      <p className="playback-detail-flow">{definition.dataFlow}</p>

      <ul className="playback-facts">
        {step.durationMs !== undefined ? (
          <li>
            <Clock size={13} aria-hidden="true" />
            <span>Tiempo de ejecución</span>
            <b>{step.durationMs} ms</b>
          </li>
        ) : null}
        {step.branchTaken ? (
          <li>
            <CornerDownRight size={13} aria-hidden="true" />
            <span>Camino tomado</span>
            <b>{step.branchTaken}</b>
          </li>
        ) : null}
        {step.discardedEdgeKeys.length ? (
          <li>
            <CornerDownRight size={13} aria-hidden="true" />
            <span>Caminos descartados</span>
            <b>{step.discardedEdgeKeys.join(', ')}</b>
          </li>
        ) : null}
        {step.outcome ? (
          <li>
            <CornerDownRight size={13} aria-hidden="true" />
            <span>Resultado</span>
            <b>{step.outcome}</b>
          </li>
        ) : null}
        {step.manualReview ? (
          <li className="playback-fact-review">
            <ShieldAlert size={13} aria-hidden="true" />
            <span>Intervención humana</span>
            <b>El caso se derivó a revisión manual</b>
          </li>
        ) : null}
      </ul>

      {step.referenceVersionId ? (
        <Link
          className="playback-reference"
          href={`/artifact-versions/${encodeURIComponent(step.referenceVersionId)}/graph`}
        >
          <Network size={14} aria-hidden="true" />
          <span>
            <strong>Algoritmo interno invocado</strong>
            <small>Abrir el grafo de la versión {step.referenceVersionId}</small>
          </span>
        </Link>
      ) : null}

      {step.error ? (
        <p className="playback-error" role="status">
          <TriangleAlert size={14} aria-hidden="true" />
          {step.error}
        </p>
      ) : null}

      {step.input !== undefined ? <JsonPanel label="Entradas del paso" value={step.input} /> : null}
      {step.output !== undefined ? (
        <JsonPanel label="Salidas del paso" value={step.output} />
      ) : null}
      {expected !== undefined ? <JsonPanel label="Resultado esperado" value={expected} /> : null}
    </div>
  );
}
