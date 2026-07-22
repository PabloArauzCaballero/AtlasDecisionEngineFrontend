'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { entityTypeLabel, groupHits, hitHref, type SearchHit } from './search-model';
import { useGlobalSearch } from './useGlobalSearch';

/**
 * Topbar search: as the operator types, matches from every portal domain are
 * shown in a dropdown panel; Enter (or "Ver todos") opens the full results
 * view at /search.
 */
export function GlobalSearchBox() {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const search = useGlobalSearch(term);
  const groups = groupHits(search.data?.items ?? []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function goToResults() {
    if (term.trim().length < 2) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term.trim())}`);
  }

  function openHit(hit: SearchHit) {
    const href = hitHref(hit);
    setOpen(false);
    if (href) router.push(href);
  }

  return (
    <div className="global-search" ref={containerRef}>
      <Search />
      <input
        aria-label="Buscar en ATLAS"
        placeholder="Buscar artefactos, variables, solicitudes…"
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            goToResults();
          }
          if (event.key === 'Escape') setOpen(false);
        }}
      />
      {open && search.enabled ? (
        <div className="global-search-panel" role="listbox" aria-label="Resultados de búsqueda">
          <header>
            <span>
              {search.isPending ? 'Buscando…' : `${search.data?.total ?? 0} coincidencias`}
            </span>
          </header>
          {search.data && !search.data.items.length && !search.isPending ? (
            <p className="global-search-empty">Sin coincidencias para “{term.trim()}”.</p>
          ) : null}
          {groups.map((group) => (
            <div className="global-search-group" key={group.entityType}>
              <h4>{entityTypeLabel(group.entityType)}</h4>
              {group.hits.map((hit) => (
                <button
                  type="button"
                  className="global-search-item"
                  key={`${hit.entityType}-${hit.entityId}`}
                  role="option"
                  aria-selected={false}
                  onClick={() => openHit(hit)}
                >
                  <strong>{hit.code}</strong>
                  {hit.title && hit.title !== hit.code ? <StatusBadge value={hit.title} /> : null}
                  {hit.subtitle ? <small>{hit.subtitle}</small> : null}
                </button>
              ))}
            </div>
          ))}
          {search.data && search.data.items.length ? (
            <button type="button" className="global-search-footer" onClick={goToResults}>
              Ver todos los resultados
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
