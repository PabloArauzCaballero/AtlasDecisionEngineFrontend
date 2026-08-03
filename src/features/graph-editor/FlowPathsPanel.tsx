'use client';

import { AlertTriangle, ArrowRight, Flag, Route } from 'lucide-react';
import { useState } from 'react';
import { display, type UnknownRecord } from '../../utils/records';
import { enumeratePaths } from './flow-paths';

interface Props {
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  onSelectNode?: (key: string) => void;
}

/**
 * Todas las posibilidades del árbol, en orden y de un vistazo.
 *
 * Revisar un algoritmo es preguntarse «¿qué le pasa a cada tipo de caso?», y la
 * lista de nodos no responde a eso: hay que seguir las flechas a ojo, que es
 * donde se cuela la rama olvidada. Aquí cada fila es un recorrido completo, del
 * inicio a su final, con las bifurcaciones que tomó.
 *
 * Los caminos que NO terminan en un nodo final salen primero y marcados: son el
 * agujero que deja a un caso real sin respuesta.
 */
export function FlowPathsPanel({ nodes, edges, onSelectNode }: Props) {
  const [open, setOpen] = useState(false);
  const paths = enumeratePaths(nodes, edges);
  if (!paths.length) return null;

  const openPaths = paths.filter((path) => path.open);
  // Lo que bloquea la publicación se lee primero.
  const ordered = [...openPaths, ...paths.filter((path) => !path.open)];
  const label = (key: string) => {
    const node = nodes.find((entry) => display(entry, 'key') === key);
    return node ? display(node, 'label', 'key') : key;
  };

  return (
    <section className="flow-paths">
      <button
        type="button"
        className="flow-paths-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Route size={16} aria-hidden />
        <strong>
          {paths.length} {paths.length === 1 ? 'recorrido posible' : 'recorridos posibles'}
        </strong>
        {openPaths.length ? (
          <span className="flow-paths-open">
            <AlertTriangle size={13} aria-hidden /> {openPaths.length} sin final
          </span>
        ) : (
          <span className="flow-paths-ok">todos terminan en un final</span>
        )}
      </button>

      {open ? (
        <ol className="flow-paths-list">
          {ordered.map((path, index) => (
            <li key={index} className={path.open ? 'is-open' : undefined}>
              <div className="flow-path-trail">
                {path.nodes.map((key, position) => (
                  <span key={`${key}-${position}`}>
                    <button
                      type="button"
                      className="flow-path-node"
                      onClick={() => onSelectNode?.(key)}
                    >
                      {label(key)}
                    </button>
                    {position < path.nodes.length - 1 ? (
                      <span className="flow-path-arrow">
                        <ArrowRight size={12} aria-hidden />
                        {path.branches[position] ? <em>{path.branches[position]}</em> : null}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
              {path.open ? (
                <p className="flow-path-warning">
                  <AlertTriangle size={13} aria-hidden /> Este recorrido no llega a ningún final: un
                  caso que siga este camino se quedaría sin respuesta.
                </p>
              ) : (
                <p className="flow-path-end">
                  <Flag size={13} aria-hidden /> Termina en <b>{label(path.terminal ?? '')}</b>
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
