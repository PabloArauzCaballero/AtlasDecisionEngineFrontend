'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  CONSTRAINT_FORMATS,
  parseConstraints,
  previewValidate,
  type VariableConstraints,
} from '../../contracts/constraints';
import { normalizeDataType, NUMERIC_TYPES, TEXTUAL_TYPES } from '../../contracts/data-types';

interface Props {
  dataType: unknown;
  constraints: unknown;
  onChange: (constraints: VariableConstraints) => void;
  disabled?: boolean;
}

/**
 * Configura visualmente las restricciones de una variable (§1.2) y deja probarlas con
 * un valor de ejemplo antes de guardar.
 *
 * Solo se muestran los campos que tienen sentido para el tipo: ofrecer «longitud
 * mínima» sobre un número era la forma más rápida de guardar un contrato que el
 * backend rechazaba después sin explicar por qué.
 */
export function ConstraintEditor({ dataType, constraints, onChange, disabled }: Props) {
  const type = normalizeDataType(dataType);
  const current = parseConstraints(constraints);
  const [sample, setSample] = useState('');

  const patch = (change: Partial<VariableConstraints>) => {
    const next = { ...current, ...change };
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
        delete next[key as keyof VariableConstraints];
      }
    }
    onChange(next);
  };

  const numberField = (
    key:
      | 'min'
      | 'max'
      | 'exclusiveMin'
      | 'exclusiveMax'
      | 'scale'
      | 'precision'
      | 'minLength'
      | 'maxLength'
      | 'minItems'
      | 'maxItems',
    label: string,
  ) => (
    <label className="constraint-field" key={key}>
      <span>{label}</span>
      <input
        type="number"
        disabled={disabled}
        value={current[key] ?? ''}
        onChange={(event) =>
          patch({ [key]: event.target.value === '' ? undefined : Number(event.target.value) })
        }
      />
    </label>
  );

  const preview = sample.trim() ? previewValidate(type, current, parseSample(sample)) : [];

  return (
    <div className="constraint-editor">
      <div className="constraint-grid">
        {NUMERIC_TYPES.has(type) ? (
          <>
            {numberField('min', 'Valor mínimo')}
            {numberField('max', 'Valor máximo')}
            {numberField('exclusiveMin', 'Mayor que (exclusivo)')}
            {numberField('exclusiveMax', 'Menor que (exclusivo)')}
            {type !== 'INTEGER' ? numberField('scale', 'Decimales') : null}
            {numberField('precision', 'Dígitos significativos')}
          </>
        ) : null}

        {TEXTUAL_TYPES.has(type) ? (
          <>
            {numberField('minLength', 'Longitud mínima')}
            {numberField('maxLength', 'Longitud máxima')}
            <label className="constraint-field">
              <span>Expresión regular</span>
              <input
                type="text"
                disabled={disabled}
                placeholder="^[A-Z]{3}$"
                value={current.pattern ?? ''}
                onChange={(event) => patch({ pattern: event.target.value || undefined })}
              />
            </label>
            <label className="constraint-field">
              <span>Formato</span>
              <select
                disabled={disabled}
                value={current.format ?? ''}
                onChange={(event) => patch({ format: event.target.value || undefined })}
              >
                <option value="">Sin formato específico</option>
                {CONSTRAINT_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {type === 'LIST' ? (
          <>
            {numberField('minItems', 'Mínimo de elementos')}
            {numberField('maxItems', 'Máximo de elementos')}
            <label className="constraint-field constraint-checkbox">
              <input
                type="checkbox"
                disabled={disabled}
                checked={Boolean(current.unique)}
                onChange={(event) => patch({ unique: event.target.checked || undefined })}
              />
              <span>Los elementos no pueden repetirse</span>
            </label>
          </>
        ) : null}

        <label className="constraint-field constraint-wide">
          <span>Valores permitidos (uno por línea)</span>
          <textarea
            rows={3}
            disabled={disabled}
            placeholder={'APROBADO\nRECHAZADO'}
            value={(current.allowedValues ?? []).map(String).join('\n')}
            onChange={(event) =>
              patch({
                allowedValues: event.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map(parseSample),
              })
            }
          />
        </label>
      </div>

      <div className="constraint-preview">
        <label className="constraint-field constraint-wide">
          <span>Probar un valor de ejemplo</span>
          <input
            type="text"
            placeholder="Escribe un valor y comprueba si el contrato lo acepta"
            value={sample}
            onChange={(event) => setSample(event.target.value)}
          />
        </label>
        {sample.trim() ? (
          preview.length ? (
            <p className="constraint-result constraint-invalid">
              <XCircle size={14} aria-hidden /> El valor {preview.join('; ')}.
            </p>
          ) : (
            <p className="constraint-result constraint-valid">
              <CheckCircle2 size={14} aria-hidden /> El valor cumple el contrato.
            </p>
          )
        ) : null}
        <small className="field-hint">
          Esta comprobación es orientativa: el motor vuelve a validar en el servidor antes de cada
          ejecución.
        </small>
      </div>
    </div>
  );
}

/** Interpreta el texto del formulario como número, booleano o cadena. */
function parseSample(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}
