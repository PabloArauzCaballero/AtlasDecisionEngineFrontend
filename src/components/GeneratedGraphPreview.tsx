import { CornerDownRight, Square } from 'lucide-react';
import { icons } from '../features/graph-editor/node-types';
import { ZoomableFlow } from '../features/graph-view/ZoomableFlow';
import { asRows, display, type UnknownRecord } from '../utils/records';

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

interface Step {
  node: UnknownRecord;
  /** Rama "sí" de una condición: a dónde va cuando se cumple. */
  yes?: UnknownRecord;
}

/**
 * Vista (no editable) del grafo generado al importar código. El importador
 * produce una ESCALERA de decisión — una condición por cada `if/elif` y un
 * resultado por rama —, así que se dibuja como tal: el camino principal baja por
 * los "no" y cada condición muestra a la derecha el resultado de su "sí".
 * Un import que no se pudo convertir en árbol (un solo nodo de script) se ve
 * igual, simplemente sin ramas.
 */
export function GeneratedGraphPreview({ nodes, edges = [] }: GeneratedGraphPreviewProps) {
  if (!nodes.length) return null;
  const steps = buildSteps(nodes, asRows(edges));
  return (
    // La escalera de un import de código real llega a treinta pasos: sin poder alejarla no
    // se ve la forma del algoritmo, que es justo lo que hay que revisar antes de importar.
    <ZoomableFlow label="Escala del grafo generado">
      <div className="generated-graph" role="img" aria-label="Vista del grafo generado">
        {steps.map(({ node, yes }, index) => (
          <div className="generated-graph-row" key={display(node, 'key')}>
            {index > 0 ? (
              <span className="generated-graph-link" aria-hidden="true">
                {display(nodes[index - 1] ?? {}, 'type') === 'CONDITION' ? 'no' : ''}
              </span>
            ) : null}
            <div className="generated-graph-branch">
              <NodeCard node={node} />
              {yes ? (
                <>
                  <span className="generated-graph-yes">
                    <CornerDownRight size={13} aria-hidden="true" /> sí
                  </span>
                  <NodeCard node={yes} />
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ZoomableFlow>
  );
}

function NodeCard({ node }: { node: UnknownRecord }) {
  const type = display(node, 'type');
  const Icon = (icons as Record<string, typeof Square>)[type] ?? Square;
  return (
    <div className={`generated-graph-node node-${type.toLowerCase()}`}>
      <span className="generated-graph-node-icon">
        <Icon size={18} />
      </span>
      <span className="generated-graph-node-copy">
        <strong>{display(node, 'label', 'key')}</strong>
        <small>{TYPE_LABEL[type] ?? type}</small>
      </span>
    </div>
  );
}

/**
 * Recorre el camino principal (aristas por defecto) desde el inicio y cuelga de
 * cada condición su rama "sí". Si el grafo no declara aristas se muestran los
 * nodos en el orden en que llegaron.
 */
function buildSteps(nodes: UnknownRecord[], edges: UnknownRecord[]): Step[] {
  const byKey = new Map(nodes.map((node) => [display(node, 'key'), node]));
  const start = nodes.find((node) => display(node, 'type') === 'START') ?? nodes[0];
  if (!edges.length || !start) return nodes.map((node) => ({ node }));

  const steps: Step[] = [];
  const visited = new Set<string>();
  let current: UnknownRecord | undefined = start;
  while (current && !visited.has(display(current, 'key'))) {
    const key = display(current, 'key');
    visited.add(key);
    const outgoing = edges.filter((edge) => display(edge, 'from') === key);
    const conditional = outgoing.find((edge) => !edge.default);
    const fallthrough = outgoing.find((edge) => edge.default) ?? outgoing[0];
    steps.push({
      node: current,
      yes: conditional ? byKey.get(display(conditional, 'to')) : undefined,
    });
    current = fallthrough ? byKey.get(display(fallthrough, 'to')) : undefined;
  }
  // Nodos sueltos (sin camino desde el inicio) igualmente se listan.
  for (const node of nodes) {
    const key = display(node, 'key');
    if (!visited.has(key) && !steps.some((step) => step.yes === node)) {
      steps.push({ node });
    }
  }
  return steps;
}
