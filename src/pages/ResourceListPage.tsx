import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { hasAnyRole } from '../auth/roles';
import { useEffectiveRoles } from '../auth/useAuth';
import { Alert } from '../components/Alert';
import { DataTable, type RowAction } from '../components/DataTable';
import { FilterSelect } from '../components/FilterSelect';
import { PageHeader } from '../components/PageHeader';
import { ActiveFilterChips } from '../resources/ActiveFilterChips';
import { ExportDialog } from '../resources/ExportDialog';
import { listResource } from '../resources/resource.api';
import { useUrlFilters } from '../resources/useUrlFilters';
import { ResourceCreateForm } from '../resources/ResourceCreateForm';
import { ResourceListActions } from '../resources/ResourceListActions';
import { ResourceExtraFilters } from '../resources/ResourceExtraFilters';
import type { ResourceConfig } from '../resources/resource.types';

interface ResourceListPageProps {
  config: ResourceConfig;
  onPrimaryAction?: () => void;
  primaryActionDisabled?: boolean;
  primaryActionTitle?: string;
  /**
   * Acciones por fila, cuando el recurso tiene operaciones que no son «ver detalle».
   *
   * Existe porque los despliegues necesitan revertirse y suspenderse desde el listado: son
   * acciones sobre una fila concreta y no hay pantalla de detalle donde ponerlas. Se pasa como
   * función y no como configuración estática porque la decisión depende de la FILA —sólo un
   * despliegue vivo se puede revertir— y de los roles de quien mira.
   */
  rowActions?: (row: Record<string, unknown>) => RowAction[];
}

export function ResourceListPage({
  config,
  onPrimaryAction,
  primaryActionDisabled = false,
  primaryActionTitle,
  rowActions,
}: ResourceListPageProps) {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  /*
   * Los filtros viven en la URL y los gobierna `useUrlFilters`.
   *
   * `extraFilters` alimenta la consulta; `draftExtra` guarda la edición en curso. Los selectores
   * aplican al instante; el texto libre aplica al enviar, junto con la búsqueda.
   */
  const {
    filter,
    draftFilter,
    setDraftFilter,
    extraFilters,
    draftExtra,
    setDraftExtra,
    showExtraFilters,
    setShowExtraFilters,
    apply,
    applyNow,
    clear,
    hasActiveFilters,
    activeExtraCount,
  } = useUrlFilters(config, () => setPage(1));

  // Resources that declare `createFields` get a built-in inline form; others may
  // supply a bespoke dialog via `onPrimaryAction`. Without either the alta stays
  // unavailable and the button is disabled.
  const hasInlineCreate = Boolean(config.createFields?.length);
  const openPrimary = onPrimaryAction ?? (hasInlineCreate ? () => setCreating(true) : undefined);
  // Algunos recursos se consultan con el permiso de la ruta pero se dan de alta
  // con uno más estrecho (`createRoles`). Sin declaración, alta y lectura son lo
  // mismo, que es el caso normal.
  const roles = useEffectiveRoles();
  const canCreate = !config.createRoles || hasAnyRole(roles, config.createRoles);
  const query = useQuery({
    queryKey: ['resource', config.key, page, filter, extraFilters],
    queryFn: ({ signal }) => listResource(config, { page, filter, filters: extraFilters }, signal),
    placeholderData: keepPreviousData,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply();
  };

  const clearFilters = clear;

  /** Quita un filtro concreto desde su chip; `null` es el filtro principal. */
  const removeFilter = (param: string | null) => {
    if (param === null) {
      applyNow({ filter: '' });
      return;
    }
    applyNow({ extra: { ...extraFilters, [param]: '' } });
  };

  // A dropdown reads as "apply now"; commit it to the query immediately.
  const applySelectFilter = (param: string, value: string) => {
    applyNow({ extra: { ...draftExtra, [param]: value } });
  };

  const rows = query.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        hint={config.hint}
        actions={
          <ResourceListActions
            config={config}
            hasRows={rows.length > 0}
            canCreate={canCreate}
            disabled={primaryActionDisabled}
            onCreate={openPrimary}
            createTitle={primaryActionTitle}
            onExport={() => setExporting(true)}
          />
        }
      />
      {config.filterParam ? (
        <form className="filter-bar" onSubmit={submit} data-tutorial-id="resource-filters">
          {config.filterPicker ? (
            <FilterSelect
              label={config.filterLabel ?? 'Filtro'}
              value={filter}
              endpoint={config.filterPicker.endpoint}
              valueKey={config.filterPicker.valueKey}
              labelKeys={config.filterPicker.labelKeys}
              placeholder={config.filterPlaceholder}
              onChange={(value) => applyNow({ filter: value })}
            />
          ) : (
            <label>
              <span>{config.filterLabel}</span>
              <input
                value={draftFilter}
                onChange={(event) => setDraftFilter(event.target.value)}
                placeholder={config.filterPlaceholder}
              />
            </label>
          )}
          {showExtraFilters && config.filters?.length ? (
            <ResourceExtraFilters
              filters={config.filters}
              draftExtra={draftExtra}
              setDraftExtra={setDraftExtra}
              applySelectFilter={applySelectFilter}
            />
          ) : null}
          <button className="button button-primary" type="submit">
            <Search size={17} /> Buscar
          </button>
          {hasActiveFilters ? (
            <button className="button" type="button" onClick={clearFilters}>
              <X size={16} /> Limpiar
            </button>
          ) : null}
          {config.filters?.length ? (
            <button
              className={
                showExtraFilters || activeExtraCount
                  ? 'icon-button filter-icon active'
                  : 'icon-button filter-icon'
              }
              type="button"
              data-tutorial-id="resource-more-filters"
              aria-label={
                activeExtraCount ? `Más filtros (${activeExtraCount} activos)` : 'Más filtros'
              }
              aria-expanded={showExtraFilters}
              onClick={() => setShowExtraFilters((visible) => !visible)}
            >
              <SlidersHorizontal />
              {activeExtraCount ? <span className="filter-count">{activeExtraCount}</span> : null}
            </button>
          ) : null}
        </form>
      ) : null}
      <ActiveFilterChips
        filter={filter}
        filterLabel={config.filterLabel ?? 'Filtro'}
        extraFilters={extraFilters}
        filters={config.filters ?? []}
        onRemove={removeFilter}
        onClearAll={clearFilters}
      />
      {creating && hasInlineCreate && canCreate ? (
        <ResourceCreateForm config={config} onClose={() => setCreating(false)} />
      ) : null}
      {exporting ? (
        <ExportDialog
          config={config}
          pageRows={rows}
          filter={filter}
          extraFilters={extraFilters}
          onClose={() => setExporting(false)}
        />
      ) : null}
      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}
      <section
        className="panel"
        data-tutorial-id="resource-table"
        aria-labelledby="resource-table-title"
      >
        <div className="panel-title">
          <h2 id="resource-table-title">{query.data?.total ?? 0} registros</h2>
          <small>{query.isFetching ? 'Actualizando…' : 'Datos en vivo'}</small>
        </div>
        <DataTable
          rows={rows}
          columns={config.columns}
          getRowKey={rowKey}
          detailPath={config.detailPath}
          rowActions={rowActions}
        />
        {!config.unpaged && query.data ? (
          <div className="pagination">
            <button
              className="button"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </button>
            <span>
              Página {query.data.page} de {Math.max(1, query.data.totalPages)}
            </span>
            <button
              className="button"
              type="button"
              disabled={!query.data.hasNextPage}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function rowKey(row: Record<string, unknown>): string {
  return String(row.id ?? row.code ?? row.artifactCode ?? JSON.stringify(row));
}
