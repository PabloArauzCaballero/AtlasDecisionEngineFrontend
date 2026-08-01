'use client';

import { ConstraintEditor } from '../graph-editor/ConstraintEditor';
import { DATA_TYPES, DATA_TYPE_LABELS } from '../../contracts/data-types';
import {
  ERROR_POLICIES,
  ERROR_POLICY_LABELS,
  type CalculatedFieldReturn,
} from './calculated-field.types';

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
    <label className="constraint-field" key={key}>
      <span title={hint}>{label}</span>
      <select value={value[key]} onChange={(event) => patch({ [key]: event.target.value })}>
        {ERROR_POLICIES.map((policy) => (
          <option key={policy} value={policy}>
            {ERROR_POLICY_LABELS[policy]}
          </option>
        ))}
      </select>
    </label>
  );

  const nullPolicyConflict =
    !value.nullable &&
    [value.divisionByZero, value.missingData, value.outOfRange].includes('RETURN_NULL');

  return (
    <div className="return-contract">
      <div className="constraint-grid">
        <label className="constraint-field">
          <span>Tipo devuelto</span>
          <select
            value={value.dataType}
            onChange={(event) =>
              patch({ dataType: event.target.value as CalculatedFieldReturn['dataType'] })
            }
          >
            {DATA_TYPES.map((type) => (
              <option key={type} value={type}>
                {DATA_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="constraint-field">
          <span>Decimales del resultado</span>
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
        </label>

        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={value.nullable}
            onChange={(event) => patch({ nullable: event.target.checked })}
          />
          <span>Puede devolver sin valor (null)</span>
        </label>

        <label className="constraint-field">
          <span>Código de error</span>
          <input
            value={value.errorCode}
            placeholder="DTI_NOT_COMPUTABLE"
            onChange={(event) => patch({ errorCode: event.target.value.toUpperCase() })}
          />
        </label>

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
          <label className="constraint-field constraint-wide">
            <span>¿En qué condiciones no devuelve valor? (una por línea)</span>
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
          </label>
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
