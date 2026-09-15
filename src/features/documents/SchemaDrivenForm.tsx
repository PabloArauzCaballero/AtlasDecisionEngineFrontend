'use client';

import { FieldLabel } from '../../components/FieldLabel';
import { useFieldHelp } from '../../hooks/useFieldHelp';
import type { TemplateFieldDescriptor } from './document-types';
import { Control } from './SchemaDrivenControl';
import { ayudaDeCampo } from './template-field-help';

/**
 * Construye el formulario a partir del contrato que publica el motor.
 *
 * No hay ni un formulario escrito a mano por documento, y ésa es toda la idea:
 * un template nuevo —o un campo añadido a uno existente— aparece aquí solo, sin
 * tocar el portal. La alternativa, un componente por documento, se desincroniza
 * a la primera: el motor exige un campo que la pantalla no pide y el usuario
 * recibe un 422 sobre algo que no tenía dónde escribir.
 *
 * **Los campos compuestos se editan como JSON, y se dice por qué.** Una lista de
 * objetos anidados —las filas de una tabla— necesitaría un editor entero con
 * añadir, borrar y reordenar. Fingirlo con tres cajas sería peor que un área de
 * texto honesta: al menos el JSON admite exactamente lo que el contrato admite,
 * y se puede pegar desde donde salieron los datos.
 */

export type FieldValues = Record<string, unknown>;

interface SchemaDrivenFormProps {
  fields: Readonly<Record<string, TemplateFieldDescriptor>>;
  values: FieldValues;
  onChange: (values: FieldValues) => void;
  /** Rutas con problema según el motor, para señalar el control exacto. */
  issuesByField?: Readonly<Record<string, string>>;
  disabled?: boolean;
}

export function SchemaDrivenForm({
  fields,
  values,
  onChange,
  issuesByField = {},
  disabled = false,
}: SchemaDrivenFormProps) {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return <p className="doc-form__empty">Este template no declara ningún campo.</p>;
  }

  const set = (name: string, value: unknown) => onChange({ ...values, [name]: value });

  return (
    <div className="doc-form">
      {entries.map(([name, descriptor]) => (
        <FieldControl
          key={name}
          name={name}
          descriptor={descriptor}
          value={values[name]}
          problem={issuesByField[name]}
          disabled={disabled}
          onChange={(value) => set(name, value)}
        />
      ))}
    </div>
  );
}

interface FieldControlProps {
  name: string;
  descriptor: TemplateFieldDescriptor;
  value: unknown;
  problem?: string;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

function FieldControl({ name, descriptor, value, problem, disabled, onChange }: FieldControlProps) {
  const id = `doc-field-${name}`;
  const tooltip = ayudaDeCampo(name, descriptor);
  const ayuda = useFieldHelp(tooltip);
  const describedBy = [problem ? `${id}-error` : undefined, ayuda.describedById]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`doc-form__field${problem ? ' doc-form__field--invalid' : ''}`}>
      <span className="doc-form__label">
        <FieldLabel
          htmlFor={id}
          label={name}
          tooltip={tooltip}
          describedById={ayuda.describedById}
          controlFocused={ayuda.focused}
        />
        {descriptor.required ? (
          <span className="doc-form__required"> ·&nbsp;obligatorio</span>
        ) : null}
        <span className="doc-form__type">{typeLabel(descriptor)}</span>
      </span>

      <Control
        id={id}
        name={name}
        onFocus={ayuda.onFocus}
        onBlur={ayuda.onBlur}
        descriptor={descriptor}
        value={value}
        disabled={disabled}
        describedBy={describedBy || undefined}
        invalid={Boolean(problem)}
        onChange={onChange}
      />

      {problem ? (
        <p className="doc-form__error" id={`${id}-error`} role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

function typeLabel(descriptor: TemplateFieldDescriptor): string {
  if (descriptor.type === 'enum') return `enum (${(descriptor.values ?? []).join(' · ')})`;
  if (descriptor.type === 'array' && descriptor.items) return `lista de ${descriptor.items.type}`;
  return descriptor.type;
}
