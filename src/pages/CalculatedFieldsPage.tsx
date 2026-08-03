'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../api/http-client';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { NavLink } from '../navigation/NavLink';
import { useNotifications } from '../notifications/useNotifications';
import { asRecord, asRows, display, type UnknownRecord } from '../utils/records';
import { dataTypeLabel } from '../contracts/data-types';
import {
  IMPLEMENTATION_LABELS,
  type ImplementationKind,
} from '../features/calculated-fields/calculated-field.types';
import { CalculatedFieldCreateWizard } from '../features/calculated-fields/CalculatedFieldCreateWizard';

/**
 * Catálogo de campos calculados reutilizables (§5).
 *
 * Un campo calculado NO es un artefacto: es una función pequeña que varios artefactos
 * comparten para no duplicar la misma fórmula. La lista deja claro de un vistazo qué
 * devuelve cada uno y en qué modalidad está implementado.
 */
export function CalculatedFieldsPage() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['calculated-fields', search],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(
        `/v1/calculated-fields?pageSize=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
        { signal },
      ),
  });

  const onCreated = async (created: UnknownRecord) => {
    notify({
      tone: 'success',
      title: `Campo calculado ${display(created, 'fieldCode')} creado`,
      description: 'Ya tiene su versión 1: pruébala y publícala cuando esté lista.',
    });
    setShowCreate(false);
    await queryClient.invalidateQueries({ queryKey: ['calculated-fields'] });
  };

  const rows = asRows(asRecord(query.data).items);

  return (
    <>
      <PageHeader
        eyebrow="Reutilizables"
        title="Campos calculados"
        description="Funciones pequeñas y gobernadas que varios algoritmos comparten: una relación, una edad, un porcentaje."
        actions={
          <button
            className="button button-primary"
            type="button"
            onClick={() => setShowCreate((open) => !open)}
          >
            <Plus size={16} aria-hidden /> Nuevo campo calculado
          </button>
        }
      />

      {showCreate ? (
        <Panel title="Nuevo campo calculado">
          <CalculatedFieldCreateWizard
            onCancel={() => setShowCreate(false)}
            onCreated={onCreated}
          />
        </Panel>
      ) : null}

      <Panel title="Catálogo" meta={`${rows.length} campos`}>
        <div className="output-contract-controls">
          <input
            aria-label="Buscar campo calculado"
            placeholder="Buscar por código o nombre"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Modalidad</th>
                <th>Devuelve</th>
                <th>Estado</th>
                <th>Versión</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={display(row, 'id')}>
                  <td>
                    <NavLink href={`/calculated-fields/${display(row, 'id')}`}>
                      <code>{display(row, 'fieldCode')}</code>
                    </NavLink>
                  </td>
                  <td>{display(row, 'name')}</td>
                  <td>{display(row, 'category')}</td>
                  <td>
                    {IMPLEMENTATION_LABELS[
                      display(row, 'implementationKind') as ImplementationKind
                    ] ?? '—'}
                  </td>
                  <td>{row.returnType ? dataTypeLabel(row.returnType) : '—'}</td>
                  <td>
                    <StatusBadge value={display(row, 'status')} />
                  </td>
                  <td>v{display(row, 'latestVersion') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            illustration="empty"
            title="Todavía no hay campos calculados"
            description="Un campo calculado es una fórmula pequeña y reutilizable: una relación, una edad, un porcentaje. Crea uno cuando la misma cuenta empiece a repetirse en varios algoritmos."
            example="debt_to_income = deuda mensual ÷ ingreso mensual"
          />
        )}
      </Panel>
    </>
  );
}
