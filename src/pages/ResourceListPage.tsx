import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { DataTable } from '../components/DataTable';
import { FilterSelect } from '../components/FilterSelect';
import { PageHeader } from '../components/PageHeader';
import { ActiveFilterChips } from '../resources/ActiveFilterChips';
import { ExportDialog } from '../resources/ExportDialog';
import { listResource } from '../resources/resource.api';
import { ResourceCreateForm } from '../resources/ResourceCreateForm';
import { ResourceExtraFilters } from '../resources/ResourceExtraFilters';
import type { ResourceConfig } from '../resources/resource.types';

interface ResourceListPageProps {
  config: ResourceConfig;
  onPrimaryAction?: () => void;
  primaryActionDisabled?: boolean;
  primaryActionTitle?: string;
}

export function ResourceListPage({
  config,
  onPrimaryAction,
  primaryActionDisabled = false,
  primaryActionTitle,
}: ResourceListPageProps) {
  const [page, setPage] = useState(1);
  const [draftFilter, setDraftFilter] = useState('');
  const [filter, setFilter] = useState('');
  const [showExtraFilters, setShowExtraFilters] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  // `extraFilters` drives the query; `draftExtra` holds in-progress edits. Selects
  // apply instantly; free-text extra filters apply on submit alongside the search.
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});
  const [draftExtra, setDraftExtra] = useState<Record<string, string>>({});

  // Resources that declare `createFields` get a built-in inline form; others may
  // supply a bespoke dialog via `onPrimaryAction`. Without either the alta stays
  // unavailable and the button is disabled.
  const hasInlineCreate = Boolean(config.createFields?.length);
  const openPrimary = onPrimaryAction ?? (hasInlineCreate ? () => setCreating(true) : undefined);
  const query = useQuery({
    queryKey: ['resource', config.key, page, filter, extraFilters],
    queryFn: ({ signal }) => listResource(config, { page, filter, filters: extraFilters }, signal),
    placeholderData: keepPreviousData,
  });

  /**
   * Read filters from the URL on mount: detail pages deep-link with `?filter=`,
   * and any shared/bookmarked filtered view restores its extra filters too.
   * Applied after mount so server and client render identically.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('filter');
    if (initial) {
      setDraftFilter(initial);
      setFilter(initial);
    }
    const extra: Record<string, string> = {};
    for (const entry of config.filters ?? []) {
      const value = params.get(entry.param);
      if (value) extra[entry.param] = value;
    }
    if (Object.keys(extra).length) {
      setDraftExtra(extra);
      setExtraFilters(extra);
      setShowExtraFilters(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Keep the URL in sync with the APPLIED filters (not the drafts) so a filtered
   * view is shareable and survives a refresh. replaceState avoids a history spam.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete('filter');
    for (const entry of config.filters ?? []) params.delete(entry.param);
    if (filter.trim()) params.set('filter', filter.trim());
    for (const [param, value] of Object.entries(extraFilters)) {
      if (value.trim()) params.set(param, value.trim());
    }
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [filter, extraFilters, config.filters]);

  const hasActiveFilters =
    filter.trim() !== '' || Object.values(extraFilters).some((value) => value.trim() !== '');
  const activeExtraCount = Object.values(extraFilters).filter(
    (value) => value.trim() !== '',
  ).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilter(draftFilter);
    setExtraFilters(draftExtra);
  };

  const clearFilters = () => {
    setDraftFilter('');
    setFilter('');
    setDraftExtra({});
    setExtraFilters({});
    setPage(1);
  };

  /** Quita un filtro concreto desde su chip; `null` es el filtro principal. */
  const removeFilter = (param: string | null) => {
    setPage(1);
    if (param === null) {
      setDraftFilter('');
      setFilter('');
      return;
    }
    const next = { ...extraFilters, [param]: '' };
    setDraftExtra((current) => ({ ...current, [param]: '' }));
    setExtraFilters(next);
  };

  // A dropdown reads as "apply now"; commit it to the query immediately.
  const applySelectFilter = (param: string, value: string) => {
    const next = { ...draftExtra, [param]: value };
    setDraftExtra(next);
    setExtraFilters(next);
    setPage(1);
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
          <>
            <button
              className="button"
              type="button"
              disabled={!rows.length}
              onClick={() => setExporting(true)}
            >
              <Download size={16} /> Exportar
            </button>
            {config.primaryAction ? (
              <button
                className="button button-primary"
                type="button"
                data-tutorial-id="resource-create"
                disabled={primaryActionDisabled || !openPrimary}
                title={
                  primaryActionTitle ??
                  (openPrimary ? undefined : 'Esta alta aún no está disponible en esta vista')
                }
                onClick={openPrimary}
              >
                <Plus size={16} /> {config.primaryAction}
              </button>
            ) : null}
          </>
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
              onChange={(value) => {
                setDraftFilter(value);
                setFilter(value);
                setPage(1);
              }}
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
      {creating && hasInlineCreate ? (
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
      <section className="panel" data-tutorial-id="resource-table">
        <div className="panel-title">
          <span>{query.data?.total ?? 0} registros</span>
          <small>{query.isFetching ? 'Actualizando…' : 'Datos en vivo'}</small>
        </div>
        <DataTable
          rows={rows}
          columns={config.columns}
          getRowKey={rowKey}
          detailPath={config.detailPath}
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
