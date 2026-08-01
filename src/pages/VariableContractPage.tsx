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
import { dataTypeLabel } from '../contracts/data-types';
import { describeConstraints, parseConstraints } from '../contracts/constraints';
import {
  VariableContractEditor,
  emptyContractDraft,
  toPayload,
  type VariableContractDraft,
} from '../features/variables/VariableContractEditor';

interface Props {
  definitionId: string;
}

/**
 * Contrato de una variable del catálogo (§1.1, §1.2).
 *
 * Reúne en un solo sitio lo que antes no existía: el historial de versiones con sus
 * restricciones, quién usa la variable —y por tanto a quién afecta cambiarla— y el
 * formulario para crear la siguiente versión validándola antes de guardarla.
 */
export function VariableContractPage({ definitionId }: Props) {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<VariableContractDraft>(emptyContractDraft());
  const [showForm, setShowForm] = useState(false);

  const detail = useQuery({
    queryKey: ['variable', definitionId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/variables/${encodeURIComponent(definitionId)}`, { signal }),
  });

  const dependencies = useQuery({
    queryKey: ['variable-dependencies', definitionId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/variables/${encodeURIComponent(definitionId)}/dependencies`, {
        signal,
      }),
  });

  const createVersion = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(`/v1/variables/${encodeURIComponent(definitionId)}/versions`, {
        method: 'POST',
        body: toPayload(draft),
      }),
    onSuccess: async (created) => {
      notify({
        tone: 'success',
        title: `Versión ${display(created, 'versionNumber')} creada`,
        description: 'El contrato queda inmutable: los cambios futuros van en una versión nueva.',
      });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['variable', definitionId] });
    },
  });

  const variable = asRecord(detail.data);
  const versions = asRows(variable.versions);
  const uses = asRecord(dependencies.data);
  const useItems = asRows(uses.items);

  return (
    <>
      <PageHeader
        eyebrow="Contrato de variable"
        title={display(variable, 'canonicalName') || display(variable, 'variableCode')}
        description={display(variable, 'businessDescription')}
        hint="Aquí se define qué valores acepta el motor para esta variable. El backend impone estas reglas en cada ejecución."
        actions={
          <button
            className="button button-primary"
            type="button"
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? 'Cancelar' : 'Nueva versión del contrato'}
          </button>
        }
      />

      {detail.isError ? <Alert tone="error">{errorMessage(detail.error)}</Alert> : null}
      {createVersion.isError ? (
        <Alert tone="error">{errorMessage(createVersion.error)}</Alert>
      ) : null}

      {showForm ? (
        <Panel title="Nueva versión">
          {uses.deployed ? (
            <Alert tone="warning">
              {String(uses.deployed)} versión(es) desplegadas usan esta variable. Un cambio que
              estreche el contrato será rechazado por el servidor.
            </Alert>
          ) : null}
          <VariableContractEditor definitionId={definitionId} draft={draft} onChange={setDraft} />
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

      <Panel title="Versiones del contrato" meta={`${versions.length} versiones`}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Versión</th>
              <th>Tipo</th>
              <th>Admite nulos</th>
              <th>Restricciones</th>
              <th>Origen</th>
              <th>Vigente desde</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={display(version, 'id')}>
                <td>v{display(version, 'versionNumber')}</td>
                <td>{dataTypeLabel(version.dataType)}</td>
                <td>{version.nullable ? 'sí' : 'no'}</td>
                <td>
                  {describeConstraints(
                    parseConstraints(version.constraintsJson ?? version.validationSchemaJson),
                  ).join(' · ') || '—'}
                </td>
                <td>{display(version, 'expectedOrigin') || '—'}</td>
                <td>
                  {display(version, 'effectiveFrom')
                    ? new Date(display(version, 'effectiveFrom')).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Quién usa esta variable"
        meta={`${String(uses.total ?? 0)} usos · ${String(uses.deployed ?? 0)} desplegados`}
      >
        {useItems.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Algoritmo</th>
                <th>Versión</th>
                <th>Estado</th>
                <th>Uso</th>
                <th>Obligatoria</th>
              </tr>
            </thead>
            <tbody>
              {useItems.map((use, index) => (
                <tr key={index}>
                  <td>
                    <code>{display(use, 'artifactCode')}</code> {display(use, 'artifactName')}
                  </td>
                  <td>{display(use, 'semanticVersion')}</td>
                  <td>
                    <StatusBadge value={display(use, 'status')} />
                  </td>
                  <td>{display(use, 'usageType')}</td>
                  <td>{use.isRequired ? 'sí' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="field-hint">
            Ningún algoritmo usa todavía esta variable: cambiar su contrato no afecta a nadie.
          </p>
        )}
      </Panel>
    </>
  );
}
