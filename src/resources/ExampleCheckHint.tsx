'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { parseConstraints, previewValidate } from '../contracts/constraints';
import { normalizeDataType } from '../contracts/data-types';

interface Props {
  /** Texto JSON del ejemplo tal como se escribió. */
  value: string;
  dataType: string;
  /** Texto JSON de las restricciones declaradas en el mismo formulario. */
  constraints: string;
  /** `VALID` debe cumplir el contrato; `INVALID` debe incumplirlo. */
  expects: 'VALID' | 'INVALID';
}

/**
 * Comprueba en el momento que el ejemplo hace lo que promete (§1.2).
 *
 * Un «ejemplo válido» que el contrato rechaza —o un «inválido» que acepta—
 * documenta mal la variable y el backend lo rechaza al guardar. Verlo aquí evita
 * el viaje de ida y vuelta.
 *
 * Es una comprobación de cortesía: la autoritativa la hace el motor, que reevalúa
 * el contrato entero antes de aceptar la versión.
 */
export function ExampleCheckHint({ value, dataType, constraints, expects }: Props) {
  const type = normalizeDataType(dataType);
  if (!value.trim() || !type) return null;

  const parsed = safeParse(value);
  if (parsed === undefined) return null;

  const errors = previewValidate(type, parseConstraints(safeParse(constraints)), parsed);
  const passes = errors.length === 0;
  const asExpected = expects === 'VALID' ? passes : !passes;

  if (asExpected) {
    return (
      <small className="example-check example-ok">
        <CheckCircle2 size={13} aria-hidden />{' '}
        {expects === 'VALID'
          ? 'Cumple el tipo y las restricciones.'
          : 'El contrato lo rechaza, que es lo que debe hacer.'}
      </small>
    );
  }

  return (
    <small className="example-check example-warn">
      <AlertTriangle size={13} aria-hidden />{' '}
      {expects === 'VALID'
        ? `Este ejemplo NO cumple el contrato: ${errors.join('; ')}.`
        : 'El contrato acepta este ejemplo, así que no demuestra nada: elige un valor que deba rechazarse.'}
    </small>
  );
}

function safeParse(text: string): unknown {
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    // Texto suelto: es una cadena válida para una variable de texto.
    return /^[[{]|^-?\d/.test(text) ? undefined : text;
  }
}
