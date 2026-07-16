import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { listResource } from '../resources/resource.api';
import type { ResourceConfig } from '../resources/resource.types';

export function ResourceListPage({ config }: { config: ResourceConfig }) {
  const [page, setPage] = useState(1);
  const [draftFilter, setDraftFilter] = useState('');
  const [filter, setFilter] = useState('');
  const query = useQuery({
    queryKey: ['resource', config.key, page, filter],
    queryFn: ({ signal }) => listResource(config, { page, filter }, signal),
    placeholderData: keepPreviousData,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilter(draftFilter);
  };

  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={
          <>
            <button className="button" type="button">
              <Download size={16} /> Exportar
            </button>
            {config.primaryAction ? (
              <button className="button button-primary" type="button">
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
          {(config.staticFilters ?? []).map((filterName) => (
            <label key={filterName}>
              <span>{filterName}</span>
              <select defaultValue="">
                <option value="">Todos</option>
                <option>Activo</option>
                <option>Pendiente</option>
              </select>
            </label>
          ))}
          <button className="button button-primary" type="submit">
            <Search size={17} /> Buscar
          </button>
          <button className="icon-button filter-icon" type="button" aria-label="Más filtros">
            <SlidersHorizontal />
          </button>
        </form>
      ) : null}
      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}
      <section className="panel">
        <div className="panel-title">
          <span>{query.data?.total ?? 0} registros</span>
          <small>{query.isFetching ? 'Actualizando…' : 'Datos en vivo'}</small>
        </div>
        <DataTable
          rows={query.data?.items ?? []}
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
