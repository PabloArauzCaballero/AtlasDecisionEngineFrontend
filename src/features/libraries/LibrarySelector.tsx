'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { LibraryChip } from './LibraryChip';

interface Props {
  /** Lenguaje de la implementación; filtra el catálogo (§7). */
  language: string;
  /** Ambiente destino; una librería no habilitada ahí no puede seleccionarse. */
  environment?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/**
 * Panel de selección de librerías autorizadas (§7).
 *
 * Solo ofrece lo que el registro aprueba para ese lenguaje y ambiente. No existe un
 * campo libre donde escribir un paquete: elegir de un catálogo cerrado es lo que impide
 * que una selección se convierta en una importación arbitraria.
 */
export function LibrarySelector({ language, environment, selectedIds, onChange, disabled }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const catalog = useQuery({
    queryKey: ['approved-libraries', language, environment],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(
        `/v1/libraries?pageSize=100&language=${encodeURIComponent(language)}${
          environment ? `&environment=${encodeURIComponent(environment)}` : ''
        }`,
        { signal },
      ),
    enabled: language !== 'OPERATION',
  });

  const items = asRows(asRecord(catalog.data).items);
  const categories = useMemo(
    () => [...new Set(items.map((item) => display(item, 'category')))].sort(),
    [items],
  );
  const visible = items.filter((item) => {
    const matchesCategory = !category || display(item, 'category') === category;
    const haystack =
      `${display(item, 'logicalName')} ${display(item, 'description')}`.toLowerCase();
    return matchesCategory && (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  });
  const selected = items.filter((item) => selectedIds.includes(display(item, 'id')));

  if (language === 'OPERATION') {
    return (
      <p className="field-hint">
        El constructor visual solo usa operaciones del catálogo autorizado: no necesita librerías
        externas.
      </p>
    );
  }

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id],
    );
  };

  return (
    <div className="library-selector">
      <div className="library-selected">
        {selected.length ? (
          selected.map((library) => (
            <LibraryChip
              key={display(library, 'id')}
              library={library}
              onRemove={disabled ? undefined : () => toggle(display(library, 'id'))}
            />
          ))
        ) : (
          <small className="field-hint">Sin librerías seleccionadas.</small>
        )}
      </div>

      {!disabled ? (
        <>
          <div className="library-filters">
            <label className="library-search">
              <Search size={14} aria-hidden />
              <input
                placeholder="Buscar librería"
                aria-label="Buscar librería autorizada"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="Categoría de librería"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {catalog.isError ? (
            <small className="field-hint">No se pudo cargar el catálogo de librerías.</small>
          ) : null}

          <ul className="library-catalog">
            {visible.map((library) => {
              const id = display(library, 'id');
              const status = display(library, 'status');
              const blocked = status === 'BLOCKED';
              return (
                <li key={id} className={selectedIds.includes(id) ? 'is-selected' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={selectedIds.includes(id)}
                      onChange={() => toggle(id)}
                    />
                    <div>
                      <strong>
                        {display(library, 'logicalName')} @{display(library, 'version')}
                      </strong>
                      <small>{display(library, 'description')}</small>
                      <small className="library-functions">
                        {(Array.isArray(library.allowedFunctions) ? library.allowedFunctions : [])
                          .slice(0, 6)
                          .map(String)
                          .join(' · ')}
                      </small>
                      {display(library, 'knownRisks') ? (
                        <small className="library-risk">{display(library, 'knownRisks')}</small>
                      ) : null}
                    </div>
                  </label>
                </li>
              );
            })}
            {!visible.length && !catalog.isPending ? (
              <li>
                <small className="field-hint">
                  Ninguna librería aprobada coincide con el filtro para {language}
                  {environment ? ` en ${environment}` : ''}.
                </small>
              </li>
            ) : null}
          </ul>
        </>
      ) : null}
    </div>
  );
}
