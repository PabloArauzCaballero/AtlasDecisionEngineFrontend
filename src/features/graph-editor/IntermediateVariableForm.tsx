'use client';

import { display, type UnknownRecord } from '../../utils/records';
import {
  DATA_TYPE_LABELS,
  SENSITIVITY_CLASSES,
  SENSITIVITY_LABELS,
  TRACE_POLICIES,
  TRACE_POLICY_LABELS,
  normalizeDataType,
  type DataType,
} from '../../contracts/data-types';
import { ConstraintEditor } from './ConstraintEditor';

interface Props {
  intermediate: UnknownRecord;
  nodeKeys: string[];
  dataTypes: readonly DataType[];
  onPatch: (change: UnknownRecord) => void;
}

const UPDATE_POLICIES: Array<{ value: string; label: string; hint: string }> = [
  {
    value: 'SINGLE_WRITE',
    label: 'Se escribe una sola vez',
    hint: 'El nodo productor la fija y nadie puede volver a escribirla en la misma ejecución.',
  },
  {
    value: 'OVERWRITE',
    label: 'Se puede reescribir',
    hint: 'El nodo productor puede recalcularla si vuelve a visitarse.',
  },
  {
    value: 'ACCUMULATE',
    label: 'Acumula',
    hint: 'Cada escritura suma sobre el valor anterior (números, listas o texto).',
  },
];

/** Detalle editable de una variable intermedia: alcance, ciclo de vida y traza (§2.2). */
export function IntermediateVariableForm({ intermediate, nodeKeys, dataTypes, onPatch }: Props) {
  const consumers = Array.isArray(intermediate.consumerNodeKeys)
    ? intermediate.consumerNodeKeys.map(String)
    : [];
  const producer = display(intermediate, 'producerNodeKey');

  const toggleConsumer = (nodeKey: string) => {
    onPatch({
      consumerNodeKeys: consumers.includes(nodeKey)
        ? consumers.filter((key) => key !== nodeKey)
        : [...consumers, nodeKey],
    });
  };

  return (
    <div className="intermediate-form">
      <div className="constraint-grid">
        <label className="constraint-field">
          <span>Nombre visible</span>
          <input
            value={display(intermediate, 'name')}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </label>
        <label className="constraint-field">
          <span>Tipo de dato</span>
          <select
            value={normalizeDataType(intermediate.dataType)}
            onChange={(event) => onPatch({ dataType: event.target.value })}
          >
            {dataTypes.map((type) => (
              <option key={type} value={type}>
                {DATA_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="constraint-field constraint-wide">
          <span>Descripción</span>
          <textarea
            rows={2}
            value={display(intermediate, 'description')}
            onChange={(event) => onPatch({ description: event.target.value })}
          />
        </label>

        <label className="constraint-field">
          <span>Nodo que la crea</span>
          <select
            value={producer}
            onChange={(event) => onPatch({ producerNodeKey: event.target.value })}
          >
            <option value="">— elegir nodo —</option>
            {nodeKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
        <label className="constraint-field">
          <span>Estrategia de actualización</span>
          <select
            value={display(intermediate, 'updatePolicy') || 'SINGLE_WRITE'}
            onChange={(event) => onPatch({ updatePolicy: event.target.value })}
          >
            {UPDATE_POLICIES.map((policy) => (
              <option key={policy.value} value={policy.value} title={policy.hint}>
                {policy.label}
              </option>
            ))}
          </select>
        </label>

        <label className="constraint-field">
          <span>Clasificación de sensibilidad</span>
          <select
            value={display(intermediate, 'sensitivityClass') || 'INTERNAL'}
            onChange={(event) => onPatch({ sensitivityClass: event.target.value })}
          >
            {SENSITIVITY_CLASSES.map((value) => (
              <option key={value} value={value}>
                {SENSITIVITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="constraint-field">
          <span>En la traza</span>
          <select
            value={display(intermediate, 'tracePolicy') || 'FULL'}
            onChange={(event) => onPatch({ tracePolicy: event.target.value })}
          >
            {TRACE_POLICIES.map((value) => (
              <option key={value} value={value}>
                {TRACE_POLICY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={Boolean(intermediate.nullable)}
            onChange={(event) => onPatch({ nullable: event.target.checked })}
          />
          <span>Admite quedarse sin valor</span>
        </label>
      </div>

      <fieldset className="intermediate-consumers">
        <legend>Nodos autorizados a leerla</legend>
        <small className="field-hint">
          Si no marcas ninguno, cualquier nodo posterior al productor puede leerla.
        </small>
        <div className="consumer-chips">
          {nodeKeys
            .filter((key) => key !== producer)
            .map((key) => (
              <label
                key={key}
                className={`consumer-chip${consumers.includes(key) ? ' is-on' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={consumers.includes(key)}
                  onChange={() => toggleConsumer(key)}
                />
                {key}
              </label>
            ))}
        </div>
      </fieldset>

      <details className="intermediate-constraints">
        <summary>Restricciones del valor</summary>
        <ConstraintEditor
          dataType={intermediate.dataType}
          constraints={intermediate.constraints}
          onChange={(constraints) => onPatch({ constraints })}
        />
      </details>
    </div>
  );
}
