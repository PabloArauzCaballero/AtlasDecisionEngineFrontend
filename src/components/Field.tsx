'use client';

import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useFieldHelp } from '../hooks/useFieldHelp';
import { FieldLabel } from './FieldLabel';
import { InfoHint } from './InfoHint';
import { OptionSelect } from './OptionSelect';

interface FieldProps {
  label: ReactNode;
  /** Qué poner y por qué importa (+ ejemplo si el formato no es obvio). */
  tooltip: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

type AnyProps = Record<string, unknown>;
type Handler = ((...args: unknown[]) => void) | undefined;

const juntar = (...ids: Array<string | undefined>) => ids.filter(Boolean).join(' ') || undefined;
const encadenar =
  (propio: Handler, ayuda: () => void) =>
  (...args: unknown[]) => {
    propio?.(...args);
    ayuda();
  };

function esControl(child: ReactElement): boolean {
  if (child.type === OptionSelect || child.type === 'textarea' || child.type === 'select') {
    return true;
  }
  return child.type === 'input' && (child.props as AnyProps).type !== 'hidden';
}

/** Primer control del árbol (entrando en fragmentos), para saber su `id`. */
function primerControl(children: ReactNode): ReactElement | null {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    if (child.type === Fragment) {
      const dentro = primerControl((child.props as { children?: ReactNode }).children);
      if (dentro) return dentro;
    } else if (esControl(child)) {
      return child;
    }
  }
  return null;
}

/**
 * Un campo con su ayuda, sin reescribir el control.
 *
 * Migrar ~300 campos a un componente con `render prop` era reescribir cada
 * control. Aquí basta cambiar el envoltorio: `<label className="field"><span>X
 * </span><input/></label>` pasa a `<Field label="X" tooltip="…"><input/></Field>`,
 * y `Field` cablea el PRIMER control que encuentre (input, textarea u
 * `OptionSelect`, también dentro de un fragmento): le pone `id` para el
 * `htmlFor`, le suma el `aria-describedby` de la ayuda y le encadena
 * `onFocus`/`onBlur` para abrir la burbuja al entrar con el teclado. Los
 * manejadores que ya tuviera el control se conservan.
 *
 * Si el control es un componente propio que no reenvía esas props, usa
 * `FieldRow`, que las entrega explícitas.
 */
export function Field({ label, tooltip, required, className, children }: FieldProps) {
  const ayuda = useFieldHelp(tooltip);
  const control = primerControl(children);
  const id =
    ((control?.props as AnyProps | undefined)?.id as string | undefined) ?? ayuda.controlId;

  let cableado = false;
  const cablear = (nodos: ReactNode): ReactNode =>
    Children.map(nodos, (child) => {
      if (!isValidElement(child)) return child;
      const props = child.props as AnyProps;
      if (child.type === Fragment) {
        return <Fragment>{cablear(props.children as ReactNode)}</Fragment>;
      }
      if (cableado || !esControl(child)) return child;
      cableado = true;
      const comunes = {
        id,
        onFocus: encadenar(props.onFocus as Handler, ayuda.onFocus),
        onBlur: encadenar(props.onBlur as Handler, ayuda.onBlur),
      };
      return child.type === OptionSelect
        ? cloneElement(child as ReactElement<AnyProps>, {
            ...comunes,
            describedById: juntar(props.describedById as string, ayuda.describedById),
          })
        : cloneElement(child as ReactElement<AnyProps>, {
            ...comunes,
            'aria-describedby': juntar(props['aria-describedby'] as string, ayuda.describedById),
          });
    });

  return (
    <div className={className ? `field ${className}` : 'field'}>
      <FieldLabel
        htmlFor={control ? id : undefined}
        label={label}
        required={required}
        tooltip={tooltip}
        describedById={ayuda.describedById}
        controlFocused={ayuda.focused}
      />
      {cablear(children)}
    </div>
  );
}

interface CheckFieldProps {
  label: ReactNode;
  tooltip: string;
  className?: string;
  /** La casilla (o el botón de radio): `<input type="checkbox" …/>`. */
  children: ReactElement<AnyProps>;
}

/**
 * Casilla o radio con ayuda. La `<label>` envuelve al control —ahí no hay nombre
 * que contaminar— y el ⓘ va al lado, FUERA de ella.
 */
export function CheckField({ label, tooltip, className, children }: CheckFieldProps) {
  const ayuda = useFieldHelp(tooltip);
  const props = children.props;
  const casilla = cloneElement(children, {
    'aria-describedby': juntar(props['aria-describedby'] as string, ayuda.describedById),
    onFocus: encadenar(props.onFocus as Handler, ayuda.onFocus),
    onBlur: encadenar(props.onBlur as Handler, ayuda.onBlur),
  });
  const nombre = typeof label === 'string' ? label : 'esta opción';
  return (
    <span className={className ? `field-checkbox-line ${className}` : 'field-checkbox-line'}>
      <label>
        {casilla} {label}
      </label>
      <InfoHint
        text={tooltip}
        label={`Ayuda: ${nombre}`}
        describedById={ayuda.describedById}
        forceOpen={ayuda.focused}
      />
    </span>
  );
}
