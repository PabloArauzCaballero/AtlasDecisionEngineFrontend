'use client';

import { useQuery } from '@tanstack/react-query';
import { LogIn, Trash2 } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  variables: UnknownRecord[];
  onChange: (variables: UnknownRecord[]) => void;
}

/**
 * Declares the INPUT dependencies of the artifact version — the "variables a
 * considerar" that condition, switch and script editors offer in their
 * selects. Reads the slim catalog picker instead of the full variable list.
 */
export function InputVariableManager({ variables, onChange }: Props) {
  const [catalogId, setCatalogId] = useState('');
  const inputs = variables.filter(
    (item) => !String(item.usageType ?? 'INPUT').startsWith('OUTPUT'),
  );
  const catalog = useQuery({
    queryKey: ['input-variable-picker'],
    queryFn: () => apiRequest<UnknownRecord[]>('/v1/views/pickers/variables'),
  });
  const options = asRows(catalog.data);

  function addSelected() {
    const definition = options.find((item) => display(item, 'definitionId') === catalogId);
    if (!definition) return;
    const variableCode = display(definition, 'variableCode');
    if (inputs.some((item) => display(item, 'code') === variableCode)) return;
    onChange([
      ...variables,
      {
        variableVersionId: display(definition, 'latestVersionId'),
        code: variableCode,
        version: Number(definition.versionNumber ?? 1),
        dataType: display(definition, 'dataType'),
        nullable: Boolean(definition.nullable),
        validationRules: [],
        sources: [],
        required: true,
        fallbackPolicy: 'FAIL_CLOSED',
        sensitive: Boolean(definition.isSensitive),
        usageType: 'INPUT',
        dependencyPath: `input.${variableCode}`,
      },
    ]);
    setCatalogId('');
  }

  function toggleRequired(code: string) {
    onChange(
      variables.map((item) =>
        !String(item.usageType ?? 'INPUT').startsWith('OUTPUT') && display(item, 'code') === code
          ? { ...item, required: !item.required }
          : item,
      ),
    );
  }

  function removeInput(code: string) {
    onChange(
      variables.filter(
        (item) =>
          String(item.usageType ?? 'INPUT').startsWith('OUTPUT') || display(item, 'code') !== code,
      ),
    );
  }

  return (
    <section className="output-contract-panel input-contract-panel">
      <div className="output-contract-heading">
        <div>
          <strong>
            <span className="io-badge io-in">
              <LogIn size={12} /> Entradas
            </span>{' '}
            Variables a considerar
          </strong>
          <small>
            Datos que ENTRAN a la decisión. El algoritmo los evalúa en condiciones y scripts.
          </small>
        </div>
      </div>
      <div className="output-contract-controls">
        <select
          aria-label="Variable del catálogo para añadir como entrada"
          value={catalogId}
          onChange={(event) => setCatalogId(event.target.value)}
        >
          <option value="">
            {catalog.isError ? 'Catálogo no disponible' : 'Elegir variable del catálogo…'}
          </option>
          {options.map((item) => (
            <option key={display(item, 'definitionId')} value={display(item, 'definitionId')}>
              {display(item, 'variableCode')} · {display(item, 'dataType')}
            </option>
          ))}
        </select>
        <button
          className="button button-primary"
          type="button"
          disabled={!catalogId}
          onClick={addSelected}
        >
          Añadir entrada
        </button>
        <div className="output-chips">
          {inputs.map((item) => {
            const inputCode = display(item, 'code');
            return (
              <span className="output-chip" key={inputCode}>
                <button
                  type="button"
                  title={
                    item.required
                      ? 'Obligatoria: pulsa para hacerla opcional'
                      : 'Opcional: pulsa para hacerla obligatoria'
                  }
                  onClick={() => toggleRequired(inputCode)}
                >
                  {item.required ? '★' : '☆'}
                </button>
                <b>{inputCode}</b>
                <small>{display(item, 'dataType')}</small>
                <ConfirmButton
                  className=""
                  label={`Quitar la entrada ${inputCode}`}
                  title={`¿Quitar «${inputCode}» del contrato de entrada?`}
                  confirmLabel="Quitar la entrada"
                  description={
                    <p>
                      El algoritmo dejará de pedir este dato. Cualquier condición o acción que lo
                      lea se quedará sin valor, y las pruebas que lo envíen empezarán a fallar.
                    </p>
                  }
                  onConfirm={() => removeInput(inputCode)}
                >
                  <Trash2 size={12} />
                </ConfirmButton>
              </span>
            );
          })}
          {!inputs.length ? (
            <small className="field-hint">
              Sin variables de entrada: los selects de condiciones quedarán vacíos.
            </small>
          ) : null}
        </div>
      </div>
    </section>
  );
}
