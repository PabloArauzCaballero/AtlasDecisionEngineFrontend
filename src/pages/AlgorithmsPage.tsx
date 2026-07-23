'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AlgorithmVersions } from '../features/algorithms/AlgorithmVersions';
import type { PagedResponse, ResourceRow } from '../resources/resource.types';
import { asRows, display } from '../utils/records';

const STATUSES = [
  'DRAFT',
  'VALIDATED',
  'COMPILED',
  'IN_REVIEW',
  'APPROVED',
  'DEPLOYED_TO_PROD',
  'SUSPENDED',
  'RETIRED',
];

export function AlgorithmsPage() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['algorithms', page, search, status],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      return apiRequest<PagedResponse<ResourceRow>>(`/v1/artifacts?${params.toString()}`, {
        signal,
      });
    },
    placeholderData: keepPreviousData,
  });

  const rows = asRows(query.data?.items);
  const hasFilters = search.trim() !== '' || status !== '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(draft);
  };
  const clear = () => {
    setDraft('');
    setSearch('');
    setStatus('');
    setPage(1);
  };

  return (
    <>
      <PageHeader
        eyebrow="F2 · Diseño"
        title="Algoritmos y Versiones"
        description="Todos los algoritmos de decisión y su historial de versiones, en una tabla desplegable."
        hint="Cada fila es un algoritmo (artefacto). Despliégala para ver sus versiones, en qué estado está cada una y saltar a su grafo, compilación o pruebas."
      />
      <form className="filter-bar" onSubmit={submit}>
        <label>
          <span>Buscar algoritmo</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Código, nombre o equipo"
          />
        </label>
        <label>
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-primary" type="submit">
          <Search size={17} /> Buscar
        </button>
        {hasFilters ? (
          <button className="button" type="button" onClick={clear}>
            <X size={16} /> Limpiar
          </button>
        ) : null}
      </form>

      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}

      <section className="panel">
        <div className="panel-title">
          <span>{query.data?.total ?? 0} algoritmos</span>
          <small>{query.isFetching ? 'Actualizando…' : 'Datos en vivo'}</small>
        </div>
        <div className="table-wrap">
          <table className="algo-table">
            <thead>
              <tr>
                <th scope="col" aria-label="Desplegar" />
                <th scope="col">Código</th>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Última versión</th>
                <th scope="col">Estado</th>
                <th scope="col">Responsable</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = display(row, 'id');
                const isOpen = expanded === id;
                return (
                  <Fragment key={id}>
                    <tr className={isOpen ? 'algo-row open' : 'algo-row'}>
                      <td>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={isOpen ? 'Contraer' : 'Desplegar versiones'}
                          aria-expanded={isOpen}
                          onClick={() => setExpanded(isOpen ? null : id)}
                        >
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="mono">{display(row, 'artifactCode')}</td>
                      <td>{display(row, 'name')}</td>
                      <td>{display(row, 'artifactType')}</td>
                      <td>{display(row, 'latestVersion')}</td>
                      <td>
                        <StatusBadge value={row.latestStatus} />
                      </td>
                      <td>{display(row, 'ownerTeam')}</td>
                      <td>
                        <Link className="table-action" href={`/artifacts/${id}`}>
                          Ver
                        </Link>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="algo-row-detail">
                        <td colSpan={8}>
                          <AlgorithmVersions artifactId={id} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {!rows.length && !query.isPending ? (
                <tr>
                  <td colSpan={8} className="algo-empty">
                    No hay algoritmos para los filtros seleccionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {query.data ? (
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
