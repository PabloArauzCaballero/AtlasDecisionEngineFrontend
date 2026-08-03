'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { useNotifications } from '../notifications/useNotifications';
import { asRecord, asRows, display, type UnknownRecord } from '../utils/records';
import { CalculatedFieldVersionForm } from '../features/calculated-fields/CalculatedFieldVersionForm';
import { CalculatedFieldVersionList } from '../features/calculated-fields/CalculatedFieldVersionList';
import {
  emptyDraft,
  toVersionPayload,
  type CalculatedFieldDraft,
} from '../features/calculated-fields/calculated-field.types';

interface Props {
  fieldId: string;
}

/** Detalle de un campo calculado: versiones, alta de versión y prueba con ejemplos (§5, §6.1). */
export function CalculatedFieldDetailPage({ fieldId }: Props) {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CalculatedFieldDraft>(emptyDraft());
  const [showForm, setShowForm] = useState(false);
  const [issues, setIssues] = useState<UnknownRecord[]>([]);

  const query = useQuery({
    queryKey: ['calculated-field', fieldId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/calculated-fields/${encodeURIComponent(fieldId)}`, { signal }),
  });
  const field = asRecord(query.data);
  const versions = asRows(field.versions);

  const createVersion = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(`/v1/calculated-fields/${encodeURIComponent(fieldId)}/versions`, {
        method: 'POST',
        body: toVersionPayload(draft),
      }),
    onSuccess: async (created) => {
      setIssues([]);
      setShowForm(false);
      notify({
        tone: 'success',
        title: `Versión ${display(created, 'versionNumber')} creada`,
        description: `${display(created, 'executableLines')} línea(s) ejecutable(s). Ejecuta sus pruebas antes de publicarla.`,
      });
      await queryClient.invalidateQueries({ queryKey: ['calculated-field', fieldId] });
    },
    onError: (error) => {
      // El backend devuelve la lista completa de incumplimientos del contrato: mostrarlos
      // todos evita el ciclo de corregir uno, guardar y descubrir el siguiente.
      const details = asRecord(asRecord(error as unknown as UnknownRecord).details);
      setIssues(asRows(details.issues));
    },
  });

  const promote = useMutation({
    mutationFn: ({ versionId, status }: { versionId: string; status: string }) =>
      apiRequest<UnknownRecord>(
        `/v1/calculated-fields/versions/${encodeURIComponent(versionId)}/promote`,
        { method: 'POST', body: { status } },
      ),
    onSuccess: async (updated) => {
      notify({ tone: 'success', title: `Versión ahora en ${display(updated, 'status')}` });
      await queryClient.invalidateQueries({ queryKey: ['calculated-field', fieldId] });
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Campo calculado"
        title={display(field, 'name') || 'Campo calculado'}
        description={display(field, 'description')}
        actions={
          <button
            className="button button-primary"
            type="button"
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? 'Cancelar' : 'Nueva versión'}
          </button>
        }
      />

      {display(field, 'rationale') ? (
        <Panel title="Descripción">
          <p>{display(field, 'rationale')}</p>
        </Panel>
      ) : null}

      {promote.isError ? <Alert tone="error">{errorMessage(promote.error)}</Alert> : null}
      {createVersion.isError && !issues.length ? (
        <Alert tone="error">{errorMessage(createVersion.error)}</Alert>
      ) : null}
      {issues.length ? (
        <Alert tone="error">
          <strong>El contrato no es válido todavía:</strong>
          <ul>
            {issues.map((issue, index) => (
              <li key={index}>
                {display(issue, 'message')}
                {display(issue, 'path') ? ` (${display(issue, 'path')})` : ''}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {showForm ? (
        <Panel title="Nueva versión">
          <CalculatedFieldVersionForm draft={draft} onChange={setDraft} />
          <div className="panel-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={createVersion.isPending}
              onClick={() => createVersion.mutate()}
            >
              {createVersion.isPending ? 'Guardando…' : 'Guardar versión'}
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel title="Versiones" meta={`${versions.length} versiones`}>
        <CalculatedFieldVersionList
          versions={versions}
          onPromote={(versionId, status) => promote.mutate({ versionId, status })}
        />
      </Panel>

      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}
      {!versions.length && !query.isPending ? (
        <p className="field-hint">
          Este campo todavía no tiene ninguna versión. Crea una con su contrato de retorno.
        </p>
      ) : null}
      <p className="field-hint">
        Estado actual:{' '}
        <StatusBadge value={versions[0] ? display(versions[0], 'status') : 'DRAFT'} />
      </p>
    </>
  );
}
