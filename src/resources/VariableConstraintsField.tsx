'use client';

import { AlertTriangle, Braces, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { InfoHint } from '../components/InfoHint';
import { ConstraintEditor } from '../features/graph-editor/ConstraintEditor';
import { parseConstraints, type VariableConstraints } from '../contracts/constraints';
import { normalizeDataType } from '../contracts/data-types';

interface Props {
  label: string;
  help?: string;
  /** Texto JSON, el mismo formato que guardaba el campo libre. */
  value: string;
  onChange: (value: string) => void;
  /** Tipo de dato elegido en el formulario; decide qué restricciones aplican. */
  dataType: string;
}

/**
 * Restricciones de una variable, editadas campo a campo (§1.1).
 *
 * El nombre de cada restricción sale de una lista cerrada y sólo se ofrecen las
 * que aplican al tipo elegido. Escribirlas como JSON libre dejaba inventarse
 * claves —«máximo», «max_value»— que el motor descarta sin avisar: la variable se
 * guardaba sin el límite que su autor creía haber puesto.
 *
 * El modo JSON sigue disponible porque hay restricciones condicionales (por país,
 * por producto) que no caben en una tabla plana, pero avisa de lo que arriesga.
 */
export function VariableConstraintsField({ label, help, value, onChange, dataType }: Props) {
  const [raw, setRaw] = useState(false);
  const parsed = parseConstraints(safeParse(value));
  const normalized = normalizeDataType(dataType) ?? 'STRING';

  const apply = (constraints: VariableConstraints) => {
    const entries = Object.entries(constraints).filter(([, item]) => item !== undefined);
    onChange(entries.length ? JSON.stringify(Object.fromEntries(entries)) : '');
  };

  return (
    <div className="field constraints-field">
      <span className="constraints-field-head">
        <span>
          {label}
          {help ? <InfoHint text={help} label={`Qué es: ${label}`} /> : null}
        </span>
        <button type="button" className="button" onClick={() => setRaw((open) => !open)}>
          {raw ? (
            <>
              <SlidersHorizontal size={14} aria-hidden /> Editar por campos
            </>
          ) : (
            <>
              <Braces size={14} aria-hidden /> Editar como JSON
            </>
          )}
        </button>
      </span>

      {raw ? (
        <>
          <p className="constraints-json-warning">
            <AlertTriangle size={14} aria-hidden /> El nombre de cada restricción debe escribirse
            exactamente como lo espera el motor (<code>min</code>, <code>max</code>,{' '}
            <code>minLength</code>, <code>maxLength</code>, <code>allowedValues</code>,{' '}
            <code>pattern</code>, <code>scale</code>…). Una clave mal escrita no da error: se
            descarta, y la variable queda sin ese límite.
          </p>
          <textarea
            rows={3}
            spellCheck={false}
            placeholder='{ "min": 0, "max": 100000, "scale": 2 }'
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </>
      ) : (
        <ConstraintEditor dataType={normalized} constraints={parsed} onChange={apply} />
      )}
    </div>
  );
}

/** El texto puede estar a medias mientras se escribe: eso no es un error todavía. */
function safeParse(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
