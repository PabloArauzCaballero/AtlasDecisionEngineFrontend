'use client';

import { display, type UnknownRecord } from '../../utils/records';
import { normalizeDataType, type DataType } from '../../contracts/data-types';
import { ConstraintEditor } from './ConstraintEditor';
import { OptionSelect } from '../../components/OptionSelect';
import { UPDATE_POLICY_HELP, closedOptions, nodeKeyOptions } from './graph-editor-help';
import {
  dataTypeOptions,
  sensitivityOptions,
  tracePolicyOptions,
} from '../../contracts/contract-help';
import { CheckField, Field } from '../../components/Field';
import { InfoHint } from '../../components/InfoHint';

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
        <Field
          className="constraint-field"
          label="Nombre visible"
          tooltip="Cómo se llama la variable en pantalla y en la traza. Ej.: «Ingreso disponible»."
        >
          <input
            value={display(intermediate, 'name')}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </Field>
        <Field
          className="constraint-field"
          label="Tipo de dato"
          tooltip="Qué clase de valor guarda; decide qué comparaciones y restricciones admite después."
        >
          <OptionSelect
            name="dataType"
            value={normalizeDataType(intermediate.dataType)}
            onChange={(value) => onPatch({ dataType: value })}
            options={dataTypeOptions(dataTypes)}
          />
        </Field>
        <Field
          className="constraint-field constraint-wide"
          label="Descripción"
          tooltip="Qué representa y para qué la usa el algoritmo, para quien la lea sin haberla creado."
        >
          <textarea
            rows={2}
            value={display(intermediate, 'description')}
            onChange={(event) => onPatch({ description: event.target.value })}
          />
        </Field>

        <Field
          className="constraint-field"
          label="Nodo que la crea"
          tooltip="Paso del grafo que escribe su valor; nadie más puede producirla."
        >
          <OptionSelect
            name="producerNodeKey"
            value={producer}
            onChange={(value) => onPatch({ producerNodeKey: value })}
            placeholder="— elegir nodo —"
            options={nodeKeyOptions(nodeKeys)}
          />
        </Field>
        <Field
          className="constraint-field"
          label="Estrategia de actualización"
          tooltip="Si el valor queda fijo tras la primera escritura, se puede reescribir o acumula."
        >
          <OptionSelect
            name="updatePolicy"
            value={display(intermediate, 'updatePolicy') || 'SINGLE_WRITE'}
            onChange={(value) => onPatch({ updatePolicy: value })}
            options={closedOptions(UPDATE_POLICIES, UPDATE_POLICY_HELP)}
          />
        </Field>

        <Field
          className="constraint-field"
          label="Clasificación de sensibilidad"
          tooltip="Cuánto protege el motor este valor al mostrarlo y registrarlo; un dato personal no puede ir como interno."
        >
          <OptionSelect
            name="sensitivityClass"
            value={display(intermediate, 'sensitivityClass') || 'INTERNAL'}
            onChange={(value) => onPatch({ sensitivityClass: value })}
            options={sensitivityOptions()}
          />
        </Field>
        <Field
          className="constraint-field"
          label="En la traza"
          tooltip="Qué se guarda de este valor en la traza de cada ejecución que se audita."
        >
          <OptionSelect
            name="tracePolicy"
            value={display(intermediate, 'tracePolicy') || 'FULL'}
            onChange={(value) => onPatch({ tracePolicy: value })}
            options={tracePolicyOptions()}
          />
        </Field>

        <CheckField
          className="constraint-field constraint-checkbox"
          label="Admite quedarse sin valor"
          tooltip="Márcalo si la ejecución puede terminar sin que el productor la escriba, sin que eso sea un error."
        >
          <input
            type="checkbox"
            checked={Boolean(intermediate.nullable)}
            onChange={(event) => onPatch({ nullable: event.target.checked })}
          />
        </CheckField>
      </div>

      <fieldset className="intermediate-consumers">
        <legend>
          Nodos autorizados a leerla
          <InfoHint
            text="Pasos del grafo que pueden leer esta variable; los demás reciben un error si lo intentan."
            label="Ayuda: Nodos autorizados a leerla"
          />
        </legend>
        <small className="field-hint">
          Si no marcas ninguno, cualquier nodo posterior al productor puede leerla.
        </small>
        <div className="consumer-chips">
          {nodeKeys
            .filter((key) => key !== producer)
            .map((key) => (
              // sin-ayuda: cada chip es una opción del grupo; la ayuda va en la leyenda
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
