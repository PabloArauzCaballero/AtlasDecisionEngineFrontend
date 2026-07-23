import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { UnknownRecord } from '../../utils/records';
import { analyzeFlow } from './flow-analysis';

interface FlowChecklistProps {
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  inputs: UnknownRecord[];
  outputs: UnknownRecord[];
  onSelectNode?: (key: string) => void;
}

/**
 * Live input/output flow review shown above the canvas. Surfaces the same
 * consistency rules the compiler cares about — reachable terminal, produced
 * outputs, real input references — before the author hits Validar/Guardar.
 */
export function FlowChecklist({ nodes, edges, inputs, outputs, onSelectNode }: FlowChecklistProps) {
  if (!nodes.length) return null;
  const issues = analyzeFlow({ nodes, edges, inputs, outputs });
  const errors = issues.filter((issue) => issue.severity === 'error');

  return (
    <section className={`flow-checklist${issues.length ? '' : ' flow-checklist-ok'}`}>
      <div className="flow-checklist-heading">
        {issues.length ? (
          errors.length ? (
            <XCircle size={16} className="flow-icon-error" aria-hidden="true" />
          ) : (
            <AlertTriangle size={16} className="flow-icon-warn" aria-hidden="true" />
          )
        ) : (
          <CheckCircle2 size={16} className="flow-icon-ok" aria-hidden="true" />
        )}
        <strong>Revisión de flujo (entradas y salidas)</strong>
        <small>
          {issues.length
            ? `${errors.length} bloquean publicación · ${issues.length - errors.length} por revisar`
            : 'Listo para publicar'}
        </small>
      </div>
      {issues.length ? (
        <>
          <p className="flow-checklist-legend">
            Esto es una lista de verificación del borrador: los puntos en rojo{' '}
            <strong>bloquean la publicación</strong>; los ámbar son avisos y puedes seguir editando.
          </p>
          <ul className="flow-checklist-items">
            {issues.map((issue, index) => {
              const clickable = Boolean(issue.nodeKey && onSelectNode);
              return (
                <li
                  key={`${issue.code}-${issue.nodeKey ?? index}`}
                  className={`flow-${issue.severity}`}
                >
                  {clickable ? (
                    <button type="button" onClick={() => onSelectNode?.(issue.nodeKey as string)}>
                      {issue.message}
                    </button>
                  ) : (
                    <span>{issue.message}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="flow-checklist-hint">
          El inicio alcanza un nodo terminal y cada variable de salida se produce en el flujo.
        </p>
      )}
    </section>
  );
}
