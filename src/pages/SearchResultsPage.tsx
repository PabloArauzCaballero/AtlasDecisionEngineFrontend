'use client';

import { useQuery } from '@tanstack/react-query';
import { Boxes, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  entityTypeLabel,
  groupHits,
  hitHref,
  normalizeSearchResponse,
  type SearchResponse,
} from '../features/search/search-model';

export function SearchResultsPage() {
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');

  // The topbar navigates here with ?q=…; seed both the input and the query.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('q') ?? '';
    setTerm(initial);
    setSubmitted(initial.trim());
  }, []);

  const query = useQuery<SearchResponse>({
    queryKey: ['search-results', submitted],
    enabled: submitted.length >= 2,
    queryFn: ({ signal }) =>
      apiRequest(`/v1/views/search?q=${encodeURIComponent(submitted)}&limit=50`, { signal }).then(
        normalizeSearchResponse,
      ),
  });
  const groups = groupHits(query.data?.items ?? []);

  return (
    <>
      <PageHeader
        eyebrow="Portal · Búsqueda"
        title="Resultados de búsqueda"
        description="Coincidencias en artefactos, versiones, variables, reason codes, objetivos, revisiones y auditoría."
      />
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(term.trim());
        }}
      >
        <label className="global-search search-page-input">
          <Search />
          <input
            aria-label="Buscar en ATLAS"
            placeholder="Escribe al menos dos caracteres…"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </label>
        <button className="button button-primary" type="submit">
          Buscar
        </button>
      </form>
      {query.isError ? <Alert tone="error">No fue posible completar la búsqueda.</Alert> : null}
      {submitted.length < 2 ? (
        <Alert tone="info">Introduce al menos dos caracteres para buscar.</Alert>
      ) : null}
      {query.isSuccess ? (
        <p className="page-description">
          {query.data.total} coincidencia{query.data.total === 1 ? '' : 's'} para “{submitted}”.
        </p>
      ) : null}
      <div className="search-results-groups">
        {groups.map((group) => (
          <section className="panel" key={group.entityType}>
            <h2>{entityTypeLabel(group.entityType)}</h2>
            {group.hits.map((hit) => {
              const href = hitHref(hit);
              const body = (
                <>
                  <span className="search-result-kind" aria-hidden="true">
                    <Boxes size={18} />
                  </span>
                  <div>
                    <strong>{hit.code}</strong>
                    <small>{hit.title}</small>
                  </div>
                  {hit.subtitle ? <StatusBadge value={hit.subtitle} /> : <span />}
                </>
              );
              return href ? (
                <Link
                  className="search-result-row"
                  href={href}
                  key={`${hit.entityType}-${hit.entityId}`}
                >
                  {body}
                </Link>
              ) : (
                <div className="search-result-row" key={`${hit.entityType}-${hit.entityId}`}>
                  {body}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}
