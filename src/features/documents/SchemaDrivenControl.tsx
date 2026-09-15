'use client';

import { OptionSelect } from '../../components/OptionSelect';
import type { TemplateFieldDescriptor } from './document-types';
import { opcionesDeEnum } from './template-field-help';

/**
 * El control de un campo de plantilla. Vive fuera de `SchemaDrivenForm` por el
 * tope de 299 líneas del repositorio.
 *
 * Lo que el formulario sabe pintar con un control de verdad; lo demás se edita
 * como JSON, y se dice por qué.
 */
const ESCALARES = ['string', 'number', 'integer', 'boolean', 'date', 'enum'];

interface ControlProps {
  id: string;
  name: string;
  onFocus?: () => void;
  onBlur?: () => void;
  descriptor: TemplateFieldDescriptor;
  value: unknown;
  disabled: boolean;
  describedBy?: string;
  invalid: boolean;
  onChange: (value: unknown) => void;
}

export function Control({
  id,
  name,
  descriptor,
  value,
  disabled,
  describedBy,
  invalid,
  onFocus,
  onBlur,
  onChange,
}: ControlProps) {
  const common = {
    id,
    disabled,
    onFocus,
    onBlur,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
  };

  if (descriptor.type === 'enum') {
    return (
      <OptionSelect
        id={id}
        name={name}
        describedById={describedBy}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        placeholder="— sin elegir —"
        options={[
          {
            value: '',
            label: '— sin elegir —',
            description: 'El documento se emite sin este dato.',
          },
          ...opcionesDeEnum(name, descriptor.values ?? []),
        ]}
        onChange={(next) => onChange(next === '' ? undefined : next)}
      />
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
        name={name}
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
  onFocus,
  onBlur,
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
        onFocus={onFocus}
        rows={6}
        spellCheck={false}
        className="doc-form__json"
        defaultValue={text}
        onBlur={(event) => {
          onBlur?.();
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

/** ISO → valor de `datetime-local`, que no admite zona ni segundos con decimales. */
function toLocalInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const offset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}
