'use client';

import { useState } from 'react';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { dataTypeLabel } from '../../contracts/data-types';

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

  return (
    <div className="node-state-panel">
      <ul className="node-state-tabs" role="tablist">
        {steps.map((step) => {
          const nodeKey = display(step, 'nodeKey');
          return (
            <li key={nodeKey}>
              <button
                type="button"
                role="tab"
                aria-selected={openKey === nodeKey}
                className={openKey === nodeKey ? 'is-active' : ''}
                onClick={() => setOpenKey(nodeKey)}
              >
                {nodeKey}
              </button>
            </li>
          );
        })}
      </ul>

      {steps
        .filter((step) => display(step, 'nodeKey') === openKey)
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

function ValueGroup({
  title,
  hint,
  values,
}: {
  title: string;
  hint: string;
  values: UnknownRecord[];
}) {
  return (
    <section className="node-state-group">
      <h4>{title}</h4>
      <small className="field-hint">{hint}</small>
      {values.length ? (
        <table className="node-state-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Origen</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value) => (
              <tr key={display(value, 'code')}>
                <td>{display(value, 'code')}</td>
                <td>{dataTypeLabel(value.dataType)}</td>
                <td>
                  <StateChip state={display(value, 'state')} />
                </td>
                <td>
                  <small>
                    {ORIGIN_LABELS[display(value, 'origin')] ?? display(value, 'origin')}
                  </small>
                </td>
                <td className="node-state-value">
                  {renderValue(value.value, value.sensitivityClass)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <small className="field-hint">Sin valores en esta categoría.</small>
      )}
    </section>
  );
}

function IntermediateGroup({
  title,
  before,
  after,
  created,
  updated,
}: {
  title: string;
  before: UnknownRecord[];
  after: UnknownRecord[];
  created: string[];
  updated: string[];
}) {
  const beforeByCode = new Map(before.map((entry) => [display(entry, 'code'), entry]));
  return (
    <section className="node-state-group">
      <h4>{title}</h4>
      <small className="field-hint">
        Existen solo durante esta ejecución.{' '}
        {created.length ? `Creadas aquí: ${created.join(', ')}. ` : ''}
        {updated.length ? `Actualizadas aquí: ${updated.join(', ')}.` : ''}
      </small>
      {after.length ? (
        <table className="node-state-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Antes</th>
              <th>Después</th>
              <th>Producida por</th>
              <th>Creada en</th>
              <th>Consumida por</th>
            </tr>
          </thead>
          <tbody>
            {after.map((entry) => {
              const code = display(entry, 'code');
              const previous = beforeByCode.get(code);
              const consumers = Array.isArray(entry.consumedByNodeKeys)
                ? entry.consumedByNodeKeys.map(String)
                : [];
              return (
                <tr key={code}>
                  <td>
                    {code}
                    <small> · {dataTypeLabel(entry.dataType)}</small>
                  </td>
                  <td>
                    <StateChip state={display(previous ?? {}, 'state') || 'NOT_AVAILABLE'} />
                  </td>
                  <td>
                    <StateChip state={display(entry, 'state')} />
                    <span className="node-state-value">
                      {renderValue(entry.value, entry.sensitivityClass)}
                    </span>
                  </td>
                  <td>{display(entry, 'producerNodeKey')}</td>
                  <td>{createdAtLabel(entry)}</td>
                  <td>{consumers.length ? consumers.join(', ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <small className="field-hint">Este grafo no declara variables intermedias.</small>
      )}
    </section>
  );
}

/**
 * «Momento de creación» de una intermedia (§3.1). El backend da el índice del paso en
 * base 0; aquí se muestra en base 1 para que coincida con la numeración de la traza.
 * Ausente NO es «paso 0»: o la variable aún no existe, o nació con valor inicial antes
 * de ejecutarse ningún nodo, y confundirlos haría irreconstruible el razonamiento.
 */
function createdAtLabel(entry: UnknownRecord): string {
  const step = entry.createdAtStepIndex;
  if (typeof step === 'number') return `paso ${step + 1}`;
  return display(entry, 'state') === 'NOT_AVAILABLE' ? '—' : 'valor inicial';
}

/** De dónde viene un valor (§3.1 «origen del valor»). */
const ORIGIN_LABELS: Record<string, string> = {
  REQUEST: 'de la petición',
  PROVIDER: 'de un proveedor',
  DERIVED: 'derivado',
  CALCULATED_FIELD: 'campo calculado',
  GRAPH_NODE: 'un nodo del grafo',
  NODE: 'un nodo',
  EXPRESSION: 'una expresión',
  INTERMEDIATE: 'una intermedia',
  CONSTANT: 'constante',
  REFERENCE: 'otro artefacto',
};

const STATE_LABELS: Record<string, string> = {
  NOT_AVAILABLE: 'sin valor',
  AVAILABLE: 'disponible',
  VALID: 'válida',
  INVALID: 'inválida',
  COMPUTED: 'calculada',
  UPDATED: 'actualizada',
  CONSUMED: 'consumida',
  SKIPPED: 'omitida',
  ERROR: 'error',
  REDACTED: 'redactada',
};

function StateChip({ state }: { state: string }) {
  const normalized = state || 'NOT_AVAILABLE';
  return (
    <span className={`state-chip state-${normalized.toLowerCase()}`} title={normalized}>
      {STATE_LABELS[normalized] ?? normalized.toLowerCase()}
    </span>
  );
}

/** Un valor sensible nunca se pinta en claro, aunque el backend lo hubiera enviado. */
function renderValue(value: unknown, sensitivityClass: unknown): string {
  const sensitive = ['PII', 'SENSITIVE_PII', 'SECRET'].includes(String(sensitivityClass ?? ''));
  if (value === null || value === undefined) return '—';
  if (sensitive) return '•••';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
