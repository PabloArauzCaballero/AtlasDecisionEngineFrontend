'use client';

import type { TemplateFieldDescriptor } from './document-types';

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

/** Lo que el formulario sabe pintar con un control de verdad. */
const ESCALARES = ['string', 'number', 'integer', 'boolean', 'date', 'enum'];

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
  const describedBy = [
    problem ? `${id}-error` : undefined,
    descriptor.description ? `${id}-hint` : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`doc-form__field${problem ? ' doc-form__field--invalid' : ''}`}>
      <label className="doc-form__label" htmlFor={id}>
        {name}
        {descriptor.required ? (
          <span className="doc-form__required"> ·&nbsp;obligatorio</span>
        ) : null}
        <span className="doc-form__type">{typeLabel(descriptor)}</span>
      </label>

      {descriptor.description ? (
        <p className="doc-form__hint" id={`${id}-hint`}>
          {descriptor.description}
        </p>
      ) : null}

      <Control
        id={id}
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

interface ControlProps {
  id: string;
  descriptor: TemplateFieldDescriptor;
  value: unknown;
  disabled: boolean;
  describedBy?: string;
  invalid: boolean;
  onChange: (value: unknown) => void;
}

function Control({
  id,
  descriptor,
  value,
  disabled,
  describedBy,
  invalid,
  onChange,
}: ControlProps) {
  const common = {
    id,
    disabled,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
  };

  if (descriptor.type === 'enum') {
    return (
      <select
        {...common}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
      >
        <option value="">— sin elegir —</option>
        {(descriptor.values ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (descriptor.type === 'boolean') {
    return (
      <input
        {...common}
        type="checkbox"
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }

  if (descriptor.type === 'number' || descriptor.type === 'integer') {
    return (
      <input
        {...common}
        type="number"
        step={descriptor.type === 'integer' ? 1 : 'any'}
        value={typeof value === 'number' ? String(value) : ''}
        onChange={(event) => {
          // Vacío es AUSENTE, no cero. `Number('')` da 0, y un campo opcional
          // que se deja en blanco acabaría enviando un importe de cero.
          const raw = event.target.value;
          onChange(raw === '' ? undefined : Number(raw));
        }}
      />
    );
  }

  if (descriptor.type === 'date') {
    return (
      <input
        {...common}
        type="datetime-local"
        value={toLocalInput(value)}
        onChange={(event) => {
          const raw = event.target.value;
          // El contrato pide ISO-8601 con zona; `datetime-local` da hora local
          // sin ella. Se convierte aquí para no mandar una fecha que el motor
          // rechazaría por formato.
          onChange(raw === '' ? undefined : new Date(raw).toISOString());
        }}
      />
    );
  }

  if (!ESCALARES.includes(descriptor.type)) {
    return (
      <JsonControl
        id={id}
        descriptor={descriptor}
        value={value}
        disabled={disabled}
        describedBy={describedBy}
        invalid={invalid}
        onChange={onChange}
      />
    );
  }

  return (
    <input
      {...common}
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
    />
  );
}

/** Área de texto para listas y objetos, con el error de sintaxis a la vista. */
function JsonControl({
  id,
  descriptor,
  value,
  disabled,
  describedBy,
  invalid,
  onChange,
}: ControlProps) {
  const text = value === undefined ? '' : JSON.stringify(value, null, 2);
  return (
    <>
      <textarea
        id={id}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        rows={6}
        spellCheck={false}
        className="doc-form__json"
        defaultValue={text}
        onBlur={(event) => {
          const raw = event.target.value.trim();
          if (raw === '') {
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(raw));
          } catch {
            // Se conserva el texto tal cual para que no se pierda lo escrito; el
            // motor dirá qué falla con la ruta exacta al validar.
            onChange(raw);
          }
        }}
      />
      <p className="doc-form__hint">
        {descriptor.type === 'array'
          ? 'Lista en JSON. Se edita como texto porque un editor de filas fingido admitiría menos de lo que el contrato admite.'
          : 'Objeto en JSON, con las claves que declara el contrato.'}
      </p>
    </>
  );
}

function typeLabel(descriptor: TemplateFieldDescriptor): string {
  if (descriptor.type === 'enum') return `enum (${(descriptor.values ?? []).join(' · ')})`;
  if (descriptor.type === 'array' && descriptor.items) return `lista de ${descriptor.items.type}`;
  return descriptor.type;
}

/** ISO → valor de `datetime-local`, que no admite zona ni segundos con decimales. */
function toLocalInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const offset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}
