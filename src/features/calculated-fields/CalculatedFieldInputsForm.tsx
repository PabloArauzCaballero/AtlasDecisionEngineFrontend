'use client';

import { Trash2 } from 'lucide-react';
import { ConstraintEditor } from '../graph-editor/ConstraintEditor';
import { DATA_TYPES, DATA_TYPE_LABELS } from '../../contracts/data-types';
import { CalculatedFieldInputPicker } from './CalculatedFieldInputPicker';
import type { CalculatedFieldInput } from './calculated-field.types';

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
                <label className="constraint-field">
                  <span>Identificador</span>
                  <input value={input.id} readOnly />
                </label>
                <label className="constraint-field">
                  <span>Nombre visible</span>
                  <input
                    value={input.name}
                    onChange={(event) => patch(input.id, { name: event.target.value })}
                  />
                </label>
                <label className="constraint-field">
                  <span>Tipo</span>
                  <select
                    value={input.dataType}
                    onChange={(event) =>
                      patch(input.id, {
                        dataType: event.target.value as CalculatedFieldInput['dataType'],
                      })
                    }
                  >
                    {DATA_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DATA_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="constraint-field constraint-checkbox">
                  <input
                    type="checkbox"
                    checked={input.required}
                    onChange={(event) => patch(input.id, { required: event.target.checked })}
                  />
                  <span>Obligatoria</span>
                </label>
                <label className="constraint-field constraint-wide">
                  <span>Descripción</span>
                  <textarea
                    rows={2}
                    value={input.description}
                    onChange={(event) => patch(input.id, { description: event.target.value })}
                  />
                </label>
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
