import { Square } from 'lucide-react';
import { icons } from '../features/graph-editor/node-types';
import { display, type UnknownRecord } from '../utils/records';

interface GeneratedGraphPreviewProps {
  nodes: UnknownRecord[];
  edges?: UnknownRecord[];
}

const TYPE_LABEL: Record<string, string> = {
  START: 'Inicio',
  CONDITION: 'Condición',
  SWITCH: 'Switch',
  EXPRESSION: 'Expresión',
  SCORE: 'Score',
  RESULT: 'Resultado',
  MANUAL_REVIEW: 'Revisión',
  END: 'Fin',
};

/**
 * Vista visual (no editable) del grafo generado al importar código: dibuja los
 * nodos como tarjetas conectadas de izquierda a derecha con flechas, para que el
 * usuario VEA el grafo (START → nodo de código) y no sólo una lista de variables.
 */
export function GeneratedGraphPreview({ nodes }: GeneratedGraphPreviewProps) {
  if (!nodes.length) return null;
  return (
    <div className="generated-graph" role="img" aria-label="Vista del grafo generado">
      {nodes.map((node, index) => {
        const type = display(node, 'type');
        const Icon = (icons as Record<string, typeof Square>)[type] ?? Square;
        return (
          <div className="generated-graph-step" key={display(node, 'key')}>
            {index > 0 ? <span className="generated-graph-arrow" aria-hidden="true" /> : null}
            <div className={`generated-graph-node node-${type.toLowerCase()}`}>
              <span className="generated-graph-node-icon">
                <Icon size={18} />
              </span>
              <span className="generated-graph-node-copy">
                <strong>{display(node, 'label', 'key')}</strong>
                <small>{TYPE_LABEL[type] ?? type}</small>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
