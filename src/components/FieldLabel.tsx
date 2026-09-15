'use client';

import type { ReactNode } from 'react';
import { InfoHint } from './InfoHint';

interface FieldLabelProps {
  /** `id` del control al que nombra. Sin él pinta un `<span>` (grupos, `fieldset`). */
  htmlFor?: string;
  label: ReactNode;
  required?: boolean;
  /** Qué poner en el campo y por qué importa. Es lo que pinta el icono ⓘ. */
  tooltip?: string;
  /** `id` del texto oculto al que apunta el `aria-describedby` del control. */
  describedById?: string;
  /** El control tiene el foco: la burbuja se abre sin ratón. */
  controlFocused?: boolean;
  className?: string;
}

/**
 * La fila de etiqueta de todo campo: texto, asterisco de obligatorio y ⓘ.
 *
 * Existe para que el icono de ayuda viva FUERA de la `<label>`. Dentro, su
 * nombre accesible entra en el del campo: `getByLabel('Estado')` deja de casar
 * —lo que rompe los E2E— y el lector de pantalla anuncia «Estado Qué es: Estado»
 * antes de leer el valor. Fuera, la etiqueta nombra y la ayuda describe, que es
 * el reparto que esperan tanto ARIA como las pruebas.
 *
 * La asociación es SIEMPRE por `htmlFor`/`id`, nunca por envoltura: el control
 * ya no está dentro de la etiqueta.
 */
export function FieldLabel({
  htmlFor,
  label,
  required,
  tooltip,
  describedById,
  controlFocused,
  className,
}: FieldLabelProps) {
  const text = (
    <>
      {label}
      {required ? (
        <span className="field-label-required" aria-hidden="true">
          *
        </span>
      ) : null}
    </>
  );
  const name = typeof label === 'string' ? label : 'este campo';
  return (
    <span className={className ? `field-label ${className}` : 'field-label'}>
      {htmlFor ? <label htmlFor={htmlFor}>{text}</label> : <span>{text}</span>}
      {tooltip ? (
        <InfoHint
          text={tooltip}
          label={`Ayuda: ${name}`}
          describedById={describedById}
          forceOpen={controlFocused}
        />
      ) : null}
    </span>
  );
}
