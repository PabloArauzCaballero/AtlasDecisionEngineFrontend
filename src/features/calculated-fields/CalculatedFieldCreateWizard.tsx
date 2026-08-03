'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { CalculatedFieldVersionForm } from './CalculatedFieldVersionForm';
import { CalculatedFieldMetadataForm, type FieldMetadata } from './CalculatedFieldMetadataForm';
import { emptyDraft, toVersionPayload, type CalculatedFieldDraft } from './calculated-field.types';

interface Props {
  onCancel: () => void;
  onCreated: (created: UnknownRecord) => void;
}

/**
 * Alta completa de un campo calculado: identidad y, en el mismo flujo, QUÉ CALCULA.
 *
 * Antes el alta sólo pedía metadatos y dejaba el campo sin implementación: para
 * definir la fórmula o el código había que entrar al detalle y crear una versión,
 * un segundo paso que nadie encontraba. Aquí se piden los dos, en ese orden,
 * porque la versión necesita el id del campo que la primera llamada devuelve.
 *
 * El motor expone las dos operaciones por separado y así se dejan: si la versión
 * falla su validación, el campo queda creado y el error dice exactamente qué
 * corregir, en lugar de perder lo escrito.
 */
export function CalculatedFieldCreateWizard({ onCancel, onCreated }: Props) {
  const [metadata, setMetadata] = useState<FieldMetadata | null>(null);
  const [draft, setDraft] = useState<CalculatedFieldDraft>(emptyDraft());
  const [issues, setIssues] = useState<UnknownRecord[]>([]);

  const create = useMutation({
    mutationFn: async (meta: FieldMetadata) => {
      const field = await apiRequest<UnknownRecord>('/v1/calculated-fields', {
        method: 'POST',
        body: { ...meta },
      });
      const version = await apiRequest<UnknownRecord>(
        `/v1/calculated-fields/${encodeURIComponent(display(field, 'id'))}/versions`,
        { method: 'POST', body: toVersionPayload(draft) },
      );
      return { field, version };
    },
    onSuccess: ({ field }) => {
      setIssues([]);
      onCreated(field);
    },
    onError: (error) => {
      // El motor devuelve TODOS los incumplimientos del contrato de una vez;
      // mostrarlos juntos evita el ciclo de corregir uno y descubrir el siguiente.
      const details = asRecord(asRecord(error as unknown as UnknownRecord).details);
      setIssues(asRows(details.issues));
    },
  });

  if (!metadata) {
    return (
      <CalculatedFieldMetadataForm
        onCancel={onCancel}
        onNext={(meta) => {
          setMetadata(meta);
          setIssues([]);
        }}
      />
    );
  }

  return (
    <div className="calculated-field-wizard">
      <div className="wizard-recap">
        <span>
          <b>{metadata.fieldCode}</b> · {metadata.name}
        </span>
        <button type="button" className="button" onClick={() => setMetadata(null)}>
          Volver a los datos
        </button>
      </div>

      <p className="field-hint">
        Paso 2 de 2 — define QUÉ calcula: una operación sobre las variables de entrada, o el código
        que lo resuelve.
      </p>

      <CalculatedFieldVersionForm draft={draft} onChange={setDraft} />

      {create.isError && !issues.length ? (
        <Alert tone="error">{errorMessage(create.error)}</Alert>
      ) : null}
      {issues.length ? (
        <Alert tone="error">
          <strong>El contrato no es válido todavía:</strong>
          <ul>
            {issues.map((issue, index) => (
              <li key={index}>
                <code>{display(issue, 'code')}</code> {display(issue, 'message')}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="panel-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={create.isPending}
          onClick={() => create.mutate(metadata)}
        >
          {create.isPending ? 'Creando…' : 'Crear campo calculado'}
        </button>
      </div>
    </div>
  );
}
