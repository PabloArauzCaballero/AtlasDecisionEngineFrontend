'use client';

import { ConstraintEditor } from '../graph-editor/ConstraintEditor';
import { DATA_TYPES, DATA_TYPE_LABELS } from '../../contracts/data-types';
import {
  ERROR_POLICIES,
  ERROR_POLICY_LABELS,
  type CalculatedFieldReturn,
} from './calculated-field.types';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';
import { DATA_TYPE_HELP } from '../../contracts/contract-help';

interface Props {
  value: CalculatedFieldReturn;
  onChange: (next: CalculatedFieldReturn) => void;
}

/**
 * Contrato de retorno (§5.3). Sin él no se puede guardar el campo calculado: hay que
 * declarar qué devuelve, si puede no devolver nada, con qué precisión y qué pasa ante
 * división por cero, datos faltantes o resultados fuera de rango.
 */
export function ReturnContractForm({ value, onChange }: Props) {
  const patch = (change: Partial<CalculatedFieldReturn>) => onChange({ ...value, ...change });
  const policyField = (
    key: 'divisionByZero' | 'missingData' | 'outOfRange',
    label: string,
    hint: string,
  ) => (
    <Field className="constraint-field" key={key} label={label} tooltip={hint}>
      <OptionSelect
        name={String(key)}
        value={value[key]}
        onChange={(next) => patch({ [key]: next })}
        options={ERROR_POLICIES.map((policy) => ({
          value: policy, // sin-ayuda: cada rótulo ya es la frase que describe la política
          label: ERROR_POLICY_LABELS[policy],
        }))}
      />
    </Field>
  );

  const nullPolicyConflict =
    !value.nullable &&
    [value.divisionByZero, value.missingData, value.outOfRange].includes('RETURN_NULL');

  return (
    <div className="return-contract">
      <div className="constraint-grid">
        <Field
          className="constraint-field"
          label={'Tipo devuelto'}
          tooltip="Tipo del valor que devuelve el campo calculado."
        >
          <OptionSelect
            name="tipo-devuelto"
            value={value.dataType}
            onChange={(next) => patch({ dataType: next as CalculatedFieldReturn['dataType'] })}
            options={DATA_TYPES.map((type) => ({
              value: type,
              label: DATA_TYPE_LABELS[type],
              description: DATA_TYPE_HELP[type],
            }))}
          />
        </Field>

        <Field
          className="constraint-field"
          label="Decimales del resultado"
          tooltip="Cuántos decimales conserva el valor devuelto, de 0 a 10."
        >
          <input
            type="number"
            min={0}
            max={10}
            value={value.precision ?? ''}
            onChange={(event) =>
              patch({
                precision: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
          />
        </Field>

        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={value.nullable}
            onChange={(event) => patch({ nullable: event.target.checked })}
          />
          <span>Puede devolver sin valor (null)</span>
        </label>

        <Field
          className="constraint-field"
          label="Código de error"
          tooltip="Código que devuelve el campo cuando no puede calcular. Ej.: DTI_NOT_COMPUTABLE."
        >
          <input
            value={value.errorCode}
            placeholder="DTI_NOT_COMPUTABLE"
            onChange={(event) => patch({ errorCode: event.target.value.toUpperCase() })}
          />
        </Field>

        {policyField(
          'divisionByZero',
          'División entre cero',
          'Qué hacer si el cálculo divide entre cero.',
        )}
        {policyField(
          'missingData',
          'Datos faltantes',
          'Qué hacer si falta una entrada necesaria para calcular.',
        )}
        {policyField(
          'outOfRange',
          'Resultado fuera de rango',
          'Qué hacer si el resultado incumple las restricciones declaradas.',
        )}

        {value.nullable ? (
          <Field
            className="constraint-field constraint-wide"
            label="¿En qué condiciones no devuelve valor? (una por línea)"
            tooltip="Situaciones en las que el campo devuelve vacío; una por línea."
          >
            <textarea
              rows={2}
              value={value.nullConditions.join('\n')}
              onChange={(event) =>
                patch({
                  nullConditions: event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
        ) : null}
      </div>

      {nullPolicyConflict ? (
        <p className="contract-warning">
          Has elegido «devolver sin valor» en una política, pero el retorno está declarado como no
          nulo. El backend rechazará la versión hasta que marques que puede devolver null.
        </p>
      ) : null}
      {value.nullable && !value.nullConditions.length ? (
        <p className="contract-warning">
          Si el retorno admite null hay que documentar en qué condiciones ocurre.
        </p>
      ) : null}

      <details>
        <summary>Restricciones del valor devuelto</summary>
        <ConstraintEditor
          dataType={value.dataType}
          constraints={value.constraints}
          onChange={(constraints) => patch({ constraints })}
        />
      </details>
    </div>
  );
}
