'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { CatalogInput } from '../components/CatalogInput';
import { FieldLabel } from '../components/FieldLabel';
import { FieldRow } from '../components/FieldRow';
import { OptionSelect } from '../components/OptionSelect';
import { Panel } from '../components/Panel';
import { useFieldHelp } from '../hooks/useFieldHelp';
import { useNotifications } from '../notifications/useNotifications';
import { display, type UnknownRecord } from '../utils/records';
import {
  buildPayload,
  initialValues,
  jsonFieldErrors,
  normalizeCode,
  type FieldValue,
} from './resource-create';
import type { CreateField, ResourceConfig } from './resource.types';
import { VariableConstraintsField } from './VariableConstraintsField';
import { ExampleCheckHint } from './ExampleCheckHint';

interface FieldControlProps {
  field: CreateField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  /** Resto del formulario: las restricciones y los ejemplos dependen del tipo. */
  siblings: Record<string, FieldValue>;
}

function CheckboxField({ field, value, onChange }: Omit<FieldControlProps, 'siblings'>) {
  const ayuda = useFieldHelp(field.help);
  return (
    <div className="field field-checkbox">
      <span className="field-checkbox-line">
        <label htmlFor={ayuda.controlId}>
          <input
            id={ayuda.controlId}
            type="checkbox"
            aria-describedby={ayuda.describedById}
            checked={Boolean(value)}
            onFocus={ayuda.onFocus}
            onBlur={ayuda.onBlur}
            onChange={(event) => onChange(event.target.checked)}
          />{' '}
          {field.label}
        </label>
        {field.help ? (
          <FieldLabel
            label=""
            tooltip={field.help}
            describedById={ayuda.describedById}
            controlFocused={ayuda.focused}
          />
        ) : null}
      </span>
    </div>
  );
}

function FieldControl({ field, value, onChange, siblings }: FieldControlProps) {
  if (field.kind === 'checkbox') {
    return <CheckboxField field={field} value={value} onChange={onChange} />;
  }

  // Catalog-backed field: offers the existing enum-like / DB-sourced values but
  // lets the user type a NEW one to create it inline.
  if (field.optionsEndpoint) {
    return (
      <CatalogInput
        label={field.label}
        help={field.help}
        name={field.key}
        value={String(value)}
        onChange={onChange}
        endpoint={field.optionsEndpoint}
        queryKey={`create-option-${field.key}`}
        required={field.required}
        placeholder={field.placeholder}
        mapOption={(row: UnknownRecord) => {
          const optionValue = display(row, 'value');
          return optionValue === '—'
            ? null
            : { value: optionValue, label: display(row, 'label', 'value') };
        }}
      />
    );
  }

  const stringValue = String(value);
  const handleText = (raw: string) => onChange(field.code ? normalizeCode(raw) : raw);
  const sibling = (key?: string) => (key ? String(siblings[key] ?? '') : '');

  if (field.kind === 'constraints') {
    return (
      <VariableConstraintsField
        label={field.label}
        help={field.help}
        value={stringValue}
        onChange={onChange}
        dataType={sibling(field.dataTypeKey)}
      />
    );
  }

  return (
    <FieldRow label={field.label} tooltip={field.help} required={field.required}>
      {(control) => (
        <>
          {field.kind === 'json' ? (
            <textarea
              {...control}
              rows={3}
              spellCheck={false}
              required={field.required}
              placeholder={field.placeholder}
              value={stringValue}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : field.kind === 'textarea' ? (
            <textarea
              {...control}
              rows={3}
              required={field.required}
              placeholder={field.placeholder}
              value={stringValue}
              onChange={(event) => handleText(event.target.value)}
            />
          ) : field.kind === 'select' && field.options ? (
            <OptionSelect
              id={control.id}
              describedById={control['aria-describedby']}
              onFocus={control.onFocus}
              onBlur={control.onBlur}
              name={field.key}
              value={stringValue}
              required={field.required}
              placeholder="Elegir…"
              options={field.options}
              onChange={onChange}
            />
          ) : (
            <input
              {...control}
              required={field.required}
              placeholder={field.placeholder}
              value={stringValue}
              onChange={(event) => handleText(event.target.value)}
            />
          )}
          {field.example ? (
            <ExampleCheckHint
              value={stringValue}
              dataType={sibling(field.dataTypeKey)}
              constraints={sibling(field.constraintsKey)}
              expects={field.example}
            />
          ) : null}
        </>
      )}
    </FieldRow>
  );
}

interface ResourceCreateFormProps {
  config: ResourceConfig;
  onClose: () => void;
}

/**
 * Built-in create form for catalog resources whose config declares `createFields`.
 * Renders inline above the list and POSTs to the resource endpoint.
 */
export function ResourceCreateForm({ config, onClose }: ResourceCreateFormProps) {
  const fields = config.createFields ?? [];
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const [values, setValues] = useState(() => initialValues(fields));

  const create = useMutation({
    mutationFn: () =>
      apiRequest(config.endpoint, {
        method: 'POST',
        body: buildPayload(fields, values, config.createStaticBody),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resource', config.key] });
      notify({
        tone: 'success',
        title: 'Registro creado',
        description: `Se agregó un nuevo registro en ${config.title}.`,
      });
      onClose();
    },
  });

  const setField = (key: string, value: FieldValue) =>
    setValues((current) => ({ ...current, [key]: value }));

  // Un JSON a medias se detecta ANTES de enviar: el backend respondería 422 sin
  // decir qué campo lo rompió, y el analista perdería todo lo escrito.
  const jsonErrors = jsonFieldErrors(fields, values);
  const jsonErrorMessages = Object.values(jsonErrors);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (jsonErrorMessages.length) return;
    create.mutate();
  };

  return (
    <Panel title={config.primaryAction ?? 'Crear registro'} meta={config.title}>
      <form className="simulator-form" onSubmit={submit}>
        {fields.map((field) => (
          <FieldControl
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(value) => setField(field.key, value)}
            siblings={values}
          />
        ))}
        {jsonErrorMessages.length ? (
          <Alert tone="error">{jsonErrorMessages.join(' ')}</Alert>
        ) : null}
        {create.isError ? <Alert tone="error">{errorMessage(create.error)}</Alert> : null}
        <div className="inline-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={create.isPending || jsonErrorMessages.length > 0}
          >
            {create.isPending ? 'Creando…' : (config.primaryAction ?? 'Crear')}
          </button>
          <button className="button" type="button" disabled={create.isPending} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </Panel>
  );
}
