import { nodeTypeDefinition } from './node-catalog';

/**
 * Leyenda del lenguaje visual. Explica la forma, no sólo el color, para que
 * quien abre el editor por primera vez sepa leer el grafo sin tutorial. Es una
 * lista real y no un adorno: se lee también con lector de pantalla.
 */
export function CanvasLegend() {
  const families = [
    { type: 'START', text: 'Inicio y fin' },
    { type: 'CONDITION', text: 'Bifurcación' },
    { type: 'EXPRESSION', text: 'Código' },
    { type: 'MANUAL_REVIEW', text: 'Revisión' },
    { type: 'RESULT', text: 'Resultado' },
  ] as const;
  return (
    <ul className="canvas-legend" aria-label="Leyenda de tipos de nodo">
      {families.map(({ type, text }) => {
        const definition = nodeTypeDefinition(type);
        const Icon = definition.icon;
        return (
          <li key={type} title={definition.description}>
            <i className={`legend-mark node-${type.toLowerCase()} shape-${definition.shape}`}>
              <Icon size={11} aria-hidden="true" />
            </i>
            {text}
          </li>
        );
      })}
    </ul>
  );
}
