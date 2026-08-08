'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { IntermediateGroup, ValueGroup } from './node-state-tables';

interface Props {
  /** Pasos de la traza, tal como los devuelve el motor. */
  trace: UnknownRecord[];
}

/**
 * Estado de los valores que procesó cada nodo (§3.1).
 *
 * Distingue explícitamente lo que el nodo RECIBIÓ, lo que calculó como valor
 * intermedio y lo que llegó a publicar como salida del artefacto. Antes todo se
 * mostraba junto y cualquier valor calculado parecía una salida pública.
 *
 * **Se recorre paso a paso, con su posición a la vista.** Los saltos directos
 * siguen ahí, pero un grafo real tiene decenas de nodos y una tira de fichas no
 * dice por dónde vas ni cuánto queda: sin «paso 3 de 12» y sin anterior/
 * siguiente, seguir el recorrido en orden —que es como se depura— obligaba a
 * buscar a ojo la ficha que tocaba.
 */
export function NodeVariableStatePanel({ trace }: Props) {
  const steps = asRows(trace).filter((step) => asRecord(step.variableState).nodeKey);
  const [openKey, setOpenKey] = useState(steps.length ? display(steps[0], 'nodeKey') : '');

  if (!steps.length) {
    return (
      <p className="field-hint">
        Esta ejecución se registró con una versión anterior del motor y no incluye el estado de
        variables por nodo.
      </p>
    );
  }

  // El índice se deriva de la clave abierta y no se guarda aparte: dos estados
  // para lo mismo se desincronizan en cuanto la traza cambia bajo los pies.
  const current = Math.max(
    0,
    steps.findIndex((step) => display(step, 'nodeKey') === openKey),
  );
  /*
   * La clave EFECTIVA es la del paso que existe, no la guardada.
   *
   * `useState` corre su inicializador una sola vez, y en el detalle de ejecución
   * este panel se monta mientras la consulta todavía va en camino: ahí `steps`
   * está vacío y `openKey` nace ''. Cuando la traza llega, el filtro de abajo
   * comparaba contra esa cadena vacía y NO encontraba ningún paso: se pintaban
   * las pestañas y el paginador —«Paso 1 de 1»— y debajo no había nada. Parecía
   * que la traza no traía datos cuando el problema era que nadie la abría.
   *
   * Derivarla del índice ya saneado la ata siempre a un paso real, tanto al
   * llegar los datos como si la traza cambia bajo los pies.
   */
  const activeKey = display(steps[current], 'nodeKey');
  const goTo = (index: number) =>
    setOpenKey(display(steps[Math.min(steps.length - 1, Math.max(0, index))], 'nodeKey'));

  return (
    <div className="node-state-panel">
      <ul className="node-state-tabs" role="tablist">
        {steps.map((step, index) => {
          const nodeKey = display(step, 'nodeKey');
          return (
            <li key={nodeKey}>
              <button
                type="button"
                role="tab"
                aria-selected={activeKey === nodeKey}
                className={activeKey === nodeKey ? 'is-active' : ''}
                onClick={() => setOpenKey(nodeKey)}
              >
                <span className="node-state-tab-index">{index + 1}</span>
                {nodeKey}
              </button>
            </li>
          );
        })}
      </ul>

      <nav className="node-state-pager" aria-label="Pasos del recorrido">
        <button
          type="button"
          className="button"
          disabled={current === 0}
          onClick={() => goTo(current - 1)}
        >
          <ChevronLeft size={15} aria-hidden="true" /> Anterior
        </button>
        <span className="node-state-position" role="status">
          Paso <strong>{current + 1}</strong> de {steps.length} ·{' '}
          <code>{display(steps[current], 'nodeKey')}</code>
        </span>
        <button
          type="button"
          className="button"
          disabled={current === steps.length - 1}
          onClick={() => goTo(current + 1)}
        >
          Siguiente <ChevronRight size={15} aria-hidden="true" />
        </button>
      </nav>

      {steps
        .filter((step) => display(step, 'nodeKey') === activeKey)
        .map((step) => {
          const state = asRecord(step.variableState);
          const before = asRows(state.intermediatesBefore);
          const after = asRows(state.intermediatesAfter);
          const created = (
            Array.isArray(state.intermediatesCreated) ? state.intermediatesCreated : []
          ).map(String);
          const updated = (
            Array.isArray(state.intermediatesUpdated) ? state.intermediatesUpdated : []
          ).map(String);
          const errors = asRows(state.errors);
          const warnings = (Array.isArray(state.warnings) ? state.warnings : []).map(String);
          return (
            <div className="node-state-body" key={display(step, 'nodeKey')}>
              <p className="node-state-meta">
                <span
                  className={`state-chip state-${String(state.status ?? 'completed').toLowerCase()}`}
                >
                  {state.status === 'ERROR' ? 'con error' : 'completado'}
                </span>
                <small>{Number(state.durationUs ?? step.durationUs ?? 0)} µs</small>
              </p>
              {errors.length ? (
                <ul className="node-state-errors">
                  {errors.map((error, index) => (
                    <li key={index}>
                      <code>{display(error, 'code')}</code> {display(error, 'message')}
                    </li>
                  ))}
                </ul>
              ) : null}
              {warnings.length ? (
                <ul className="node-state-warnings">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              <ValueGroup
                title="Entradas recibidas"
                hint="Datos del contrato de entrada disponibles en este nodo."
                values={asRows(state.inputs)}
              />
              <IntermediateGroup
                title="Variables intermedias"
                before={before}
                after={after}
                created={created}
                updated={updated}
              />
              <ValueGroup
                title="Salidas publicadas"
                hint="Campos del contrato de salida que ya tienen valor tras este nodo."
                values={asRows(state.outputs)}
              />
            </div>
          );
        })}
    </div>
  );
}
