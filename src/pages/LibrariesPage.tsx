'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../api/http-client';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { LibraryPreludesPanel } from '../features/libraries/LibraryPreludesPanel';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../config/locale';
import { asRecord, asRows, display, type UnknownRecord } from '../utils/records';
import { LibraryChip } from '../features/libraries/LibraryChip';

const LANGUAGES = ['', 'JAVASCRIPT', 'PYTHON'] as const;

/**
 * Registro de librerías autorizadas (§7).
 *
 * Aquí se ve exactamente qué puede invocar un campo calculado, con la versión fijada y
 * los ambientes donde está habilitada. No hay forma de añadir un paquete escribiendo su
 * nombre: solo se pueden aprobar implementaciones ya revisadas en el repositorio.
 */
export function LibrariesPage() {
  const [language, setLanguage] = useState<string>('');
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['libraries', language, search],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(
        `/v1/libraries?pageSize=100${language ? `&language=${language}` : ''}${
          search ? `&search=${encodeURIComponent(search)}` : ''
        }`,
        { signal },
      ),
  });

  const rows = asRows(asRecord(query.data).items);
  const byCategory = new Map<string, UnknownRecord[]>();
  for (const row of rows) {
    const category = display(row, 'category');
    byCategory.set(category, [...(byCategory.get(category) ?? []), row]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Seguridad"
        title="Librerías autorizadas"
        description="Catálogo cerrado de funciones que un campo calculado puede invocar, con versión exacta y ambientes habilitados."
        hint="Seleccionar una librería no genera una importación: solo habilita funciones ya revisadas dentro del entorno aislado donde corre el código."
      />

      <LibraryPreludesPanel />
      <Panel title="Filtros">
        <div className="output-contract-controls" data-tutorial-id="library-filters">
          <input
            aria-label="Buscar librería"
            placeholder="Nombre o descripción"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Lenguaje"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {LANGUAGES.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || 'Todos los lenguajes'}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      {rows.length ? (
        [...byCategory.entries()].map(([category, items]) => (
          <Panel key={category} title={category} meta={`${items.length} librerías`}>
            <div className="library-selected">
              {items.map((library) => (
                <LibraryChip key={display(library, 'id')} library={library} />
              ))}
            </div>
            <table className="data-table" data-tutorial-id="library-table">
              <thead>
                <tr>
                  <th scope="col">Librería</th>
                  <th scope="col">Paquete real</th>
                  <th scope="col">Lenguaje</th>
                  <th scope="col">Funciones permitidas</th>
                  <th scope="col">Ambientes</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Revisada</th>
                </tr>
              </thead>
              <tbody>
                {items.map((library) => (
                  <tr key={`row-${display(library, 'id')}`}>
                    <td>
                      <code>
                        {display(library, 'logicalName')}@{display(library, 'version')}
                      </code>
                    </td>
                    <td>{display(library, 'packageName')}</td>
                    <td>{display(library, 'language')}</td>
                    <td className="library-functions">
                      {(Array.isArray(library.allowedFunctions) ? library.allowedFunctions : [])
                        .map(String)
                        .join(' · ')}
                    </td>
                    <td>
                      {(Array.isArray(library.allowedEnvironments)
                        ? library.allowedEnvironments
                        : []
                      )
                        .map(String)
                        .join(', ') || '—'}
                    </td>
                    <td>
                      <StatusBadge value={display(library, 'status')} />
                    </td>
                    <td>{formatDate(display(library, 'reviewedAt'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.some((library) => display(library, 'knownRisks')) ? (
              <ul className="library-risks">
                {items
                  .filter((library) => display(library, 'knownRisks'))
                  .map((library) => (
                    <li key={`risk-${display(library, 'id')}`}>
                      <b>{display(library, 'logicalName')}:</b> {display(library, 'knownRisks')}
                    </li>
                  ))}
              </ul>
            ) : null}
          </Panel>
        ))
      ) : (
        <EmptyState
          illustration="empty"
          title="Sin librerías aprobadas"
          description="El registro está vacío o ningún elemento coincide con el filtro. Un campo calculado sin librerías sigue pudiendo usar el constructor visual."
          example="math@1.0.0 · estadística · JavaScript"
        />
      )}
    </>
  );
}
