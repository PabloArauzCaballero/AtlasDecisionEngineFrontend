'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { CatalogInput } from '../components/CatalogInput';
import { Panel } from '../components/Panel';
import { useNotifications } from '../notifications/useNotifications';
import { display, type UnknownRecord } from '../utils/records';
import { buildPayload, initialValues, normalizeCode, type FieldValue } from './resource-create';
import type { CreateField, ResourceConfig } from './resource.types';

interface FieldControlProps {
  field: CreateField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function FieldControl({ field, value, onChange }: FieldControlProps) {
  if (field.kind === 'checkbox') {
    return (
      <label className="field">
        <span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />{' '}
          {field.label}
        </span>
      </label>
    );
  }

  // Catalog-backed field: suggests existing enum-like / DB-sourced values via a
  // <datalist> but lets the user type a NEW value to create it inline.
  if (field.optionsEndpoint) {
    return (
      <CatalogInput
        label={field.label}
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

  return (
    <label className="field">
      <span>{field.label}</span>
      {field.kind === 'textarea' ? (
        <textarea
          rows={3}
          required={field.required}
          placeholder={field.placeholder}
          value={stringValue}
          onChange={(event) => handleText(event.target.value)}
        />
      ) : field.kind === 'select' && field.options ? (
        <select
          required={field.required}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Elegir…</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          required={field.required}
          placeholder={field.placeholder}
          value={stringValue}
          onChange={(event) => handleText(event.target.value)}
        />
      )}
      {field.help ? <small>{field.help}</small> : null}
    </label>
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
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
          />
        ))}
        {create.isError ? <Alert tone="error">{errorMessage(create.error)}</Alert> : null}
        <div className="inline-actions">
          <button className="button button-primary" type="submit" disabled={create.isPending}>
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
