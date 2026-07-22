import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { useNotifications } from '../notifications/useNotifications';
import { listResource } from '../resources/resource.api';
import { ResourceCreateForm } from '../resources/ResourceCreateForm';
import type { ResourceConfig } from '../resources/resource.types';
import { downloadCsv, exportFilename, toCsv } from '../utils/download';

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
  const { notify } = useNotifications();

  // Resources that declare `createFields` get a built-in inline form; others may
  // supply a bespoke dialog via `onPrimaryAction`. Without either the alta stays
  // unavailable and the button is disabled.
  const hasInlineCreate = Boolean(config.createFields?.length);
  const openPrimary = onPrimaryAction ?? (hasInlineCreate ? () => setCreating(true) : undefined);
  const query = useQuery({
    queryKey: ['resource', config.key, page, filter],
    queryFn: ({ signal }) => listResource(config, { page, filter }, signal),
    placeholderData: keepPreviousData,
  });

  /**
   * Detail pages deep-link into lists with `?filter=` (e.g. execution logs for
   * one artifact). Applied after mount so server and client render identically.
   */
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('filter');
    if (initial) {
      setDraftFilter(initial);
      setFilter(initial);
    }
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilter(draftFilter);
  };

  const rows = query.data?.items ?? [];

  const exportRows = () => {
    downloadCsv(exportFilename(config.key, 'csv'), toCsv(rows, config.columns));
    notify({
      tone: 'success',
      title: 'Exportación generada',
      description: `${rows.length} registros de ${config.title} descargados como CSV.`,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={
          <>
            <button className="button" type="button" disabled={!rows.length} onClick={exportRows}>
              <Download size={16} /> Exportar
            </button>
            {config.primaryAction ? (
              <button
                className="button button-primary"
                type="button"
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
        <form className="filter-bar" onSubmit={submit}>
          <label>
            <span>{config.filterLabel}</span>
            <input
              value={draftFilter}
              onChange={(event) => setDraftFilter(event.target.value)}
              placeholder={config.filterPlaceholder}
            />
          </label>
          {showExtraFilters
            ? (config.staticFilters ?? []).map((filterName) => (
                <label key={filterName}>
                  <span>{filterName}</span>
                  <select defaultValue="">
                    <option value="">Todos</option>
                    <option>Activo</option>
                    <option>Pendiente</option>
                  </select>
                </label>
              ))
            : null}
          <button className="button button-primary" type="submit">
            <Search size={17} /> Buscar
          </button>
          {config.staticFilters?.length ? (
            <button
              className={
                showExtraFilters ? 'icon-button filter-icon active' : 'icon-button filter-icon'
              }
              type="button"
              aria-label="Más filtros"
              aria-expanded={showExtraFilters}
              onClick={() => setShowExtraFilters((visible) => !visible)}
            >
              <SlidersHorizontal />
            </button>
          ) : null}
        </form>
      ) : null}
      {creating && hasInlineCreate ? (
        <ResourceCreateForm config={config} onClose={() => setCreating(false)} />
      ) : null}
      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}
      <section className="panel">
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
