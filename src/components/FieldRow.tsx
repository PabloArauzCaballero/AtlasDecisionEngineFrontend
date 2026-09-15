'use client';

import type { ReactNode } from 'react';
import { useFieldHelp } from '../hooks/useFieldHelp';
import { FieldLabel } from './FieldLabel';

/** Lo que hay que poner en el control para que la ayuda funcione. */
export interface FieldControlWiring {
  id: string;
  'aria-describedby': string | undefined;
  onFocus: () => void;
  onBlur: () => void;
}

interface FieldRowProps {
  label: string;
  /** Qué poner y por qué importa (+ ejemplo si el formato no es obvio). */
  tooltip?: string;
  required?: boolean;
  className?: string;
  /** Texto de apoyo SIEMPRE visible bajo el control; no sustituye al tooltip. */
  hint?: ReactNode;
  children: (control: FieldControlWiring) => ReactNode;
}

/**
 * Un campo entero: etiqueta con su ⓘ, control asociado por `id` y ayuda leída
 * por el lector de pantalla.
 *
 * Existe para que migrar un campo no sea recordar cinco cosas. Antes cada
 * formulario escribía `<label className="field"><span>…</span><input/></label>`:
 * la asociación era por envoltura, así que cualquier icono de ayuda metido
 * dentro entraba en el nombre accesible del campo, y no había dónde colgar el
 * `aria-describedby`. Aquí la etiqueta va por `htmlFor`, el ⓘ queda fuera de
 * ella y el control recibe su cableado ya hecho.
 */
export function FieldRow({ label, tooltip, required, className, hint, children }: FieldRowProps) {
  const ayuda = useFieldHelp(tooltip);
  return (
    <div className={className ? `field ${className}` : 'field'}>
      <FieldLabel
        htmlFor={ayuda.controlId}
        label={label}
        required={required}
        tooltip={tooltip}
        describedById={ayuda.describedById}
        controlFocused={ayuda.focused}
      />
      {children({
        id: ayuda.controlId,
        'aria-describedby': ayuda.describedById,
        onFocus: ayuda.onFocus,
        onBlur: ayuda.onBlur,
      })}
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
