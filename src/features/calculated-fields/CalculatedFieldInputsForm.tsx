'use client';

import { Trash2 } from 'lucide-react';
import { ConstraintEditor } from '../graph-editor/ConstraintEditor';
import { DATA_TYPES, DATA_TYPE_LABELS } from '../../contracts/data-types';
import { CalculatedFieldInputPicker } from './CalculatedFieldInputPicker';
import type { CalculatedFieldInput } from './calculated-field.types';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';
import { DATA_TYPE_HELP } from '../../contracts/contract-help';

interface Props {
  inputs: CalculatedFieldInput[];
  onChange: (inputs: CalculatedFieldInput[]) => void;
}

/** Entradas genéricas del campo calculado con sus restricciones (§5.2). */
export function CalculatedFieldInputsForm({ inputs, onChange }: Props) {
  const patch = (id: string, change: Partial<CalculatedFieldInput>) =>
    onChange(inputs.map((input) => (input.id === id ? { ...input, ...change } : input)));

  return (
    <div className="calculated-inputs">
      <CalculatedFieldInputPicker
        taken={inputs.map((input) => input.id)}
        onAdd={(input) =>
          onChange(inputs.some((entry) => entry.id === input.id) ? inputs : [...inputs, input])
        }
        onConstraints={(id, constraints) => patch(id, { constraints })}
      />

      {inputs.length ? (
        <ul className="calculated-input-list">
          {inputs.map((input) => (
            <li key={input.id}>
              <div className="constraint-grid">
                <Field
                  className="constraint-field"
                  label="Identificador"
                  tooltip="Nombre técnico de la entrada; no cambia una vez creada."
                >
                  <input value={input.id} readOnly />
                </Field>
                <Field
                  className="constraint-field"
                  label="Nombre visible"
                  tooltip="Nombre legible de la entrada tal como se enseña en el portal."
                >
                  <input
                    value={input.name}
                    onChange={(event) => patch(input.id, { name: event.target.value })}
                  />
                </Field>
                <Field
                  className="constraint-field"
                  label={'Tipo'}
                  tooltip="Tipo de valor de esta entrada; el motor valida cada ejemplo contra él."
                >
                  <OptionSelect
                    name={`tipo-${input.id}`}
                    value={input.dataType}
                    onChange={(valor) =>
                      patch(input.id, { dataType: valor as CalculatedFieldInput['dataType'] })
                    }
                    options={DATA_TYPES.map((type) => ({
                      value: type,
                      label: DATA_TYPE_LABELS[type],
                      description: DATA_TYPE_HELP[type],
                    }))}
                  />
                </Field>
                <label className="constraint-field constraint-checkbox">
                  <input
                    type="checkbox"
                    checked={input.required}
                    onChange={(event) => patch(input.id, { required: event.target.checked })}
                  />
                  <span>Obligatoria</span>
                </label>
                <Field
                  className="constraint-field constraint-wide"
                  label="Descripción"
                  tooltip="Qué representa esta entrada y de dónde sale su valor."
                >
                  <textarea
                    rows={2}
                    value={input.description}
                    onChange={(event) => patch(input.id, { description: event.target.value })}
                  />
                </Field>
              </div>
              <details>
                <summary>Restricciones de {input.id}</summary>
                <ConstraintEditor
                  dataType={input.dataType}
                  constraints={input.constraints}
                  onChange={(constraints) => patch(input.id, { constraints })}
                />
              </details>
              <button
                type="button"
                className="button button-danger"
                onClick={() => onChange(inputs.filter((entry) => entry.id !== input.id))}
              >
                <Trash2 size={14} aria-hidden /> Quitar {input.id}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <small className="field-hint">
          Todavía sin entradas. Un campo calculado necesita al menos una para servir de algo.
        </small>
      )}
    </div>
  );
}
