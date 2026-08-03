'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  /** Motivos ya adjuntos a este campo del contrato. */
  selected: string[];
  onChange: (reasonCodes: string[]) => void;
}

/** Cuántas coincidencias se listan a la vez mientras se busca. */
const VISIBLE_MATCHES = 8;

/**
 * Motivos estructurados que pueden acompañar a un campo de salida (§4).
 *
 * `absenceReasons` explica en prosa por qué un campo opcional puede faltar; esto
 * es su equivalente legible por máquina: códigos del catálogo gobernado, los
 * mismos que emiten las acciones, para que quien consume la decisión pueda
 * ramificar por ellos en vez de leer texto.
 *
 * Se busca en vez de listar: el catálogo real ronda el centenar de códigos y
 * volcarlos todos como casillas llenaba la fila del contrato con una maraña
 * ilegible. Aquí sólo se ven los ya elegidos y las coincidencias de la búsqueda.
 */
export function OutputReasonCodesField({ selected, onChange }: Props) {
  const [search, setSearch] = useState('');

  const catalog = useQuery({
    queryKey: ['reason-code-picker'],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>('/v1/reason-codes?page=1&pageSize=200', { signal }),
  });

  // El listado es paginado (`items`), pero algunos despliegues devuelven el array
  // suelto; se aceptan las dos formas para no quedarse sin catálogo por eso.
  const data = catalog.data;
  const options = asRows(Array.isArray(data) ? data : asRecord(data).items).map((option) =>
    display(option, 'reasonCode', 'code'),
  );

  const needle = search.trim().toUpperCase();
  const matches = needle
    ? options.filter((code) => code.includes(needle) && !selected.includes(code))
    : [];

  const add = (code: string) => {
    if (!selected.includes(code)) onChange([...selected, code]);
    setSearch('');
  };
  const remove = (code: string) => onChange(selected.filter((item) => item !== code));

  if (catalog.isError) {
    return <small className="field-hint">Catálogo de motivos no disponible.</small>;
  }

  return (
    <div className="reason-code-picker">
      <span className="reason-code-legend">Motivos estructurados que puede devolver</span>

      {selected.length ? (
        <ul className="reason-code-chips">
          {selected.map((code) => (
            <li key={code}>
              <code>{code}</code>
              <button
                type="button"
                aria-label={`Quitar el motivo ${code}`}
                onClick={() => remove(code)}
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <small className="field-hint">
          Sin motivos: la respuesta no llevará códigos explicables.
        </small>
      )}

      <div className="reason-code-search">
        <Search size={13} aria-hidden />
        <input
          type="search"
          value={search}
          disabled={catalog.isLoading}
          placeholder={catalog.isLoading ? 'Cargando catálogo…' : 'Buscar un motivo por código…'}
          aria-label="Buscar un reason code para añadirlo"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {needle ? (
        <ul className="reason-code-matches">
          {matches.slice(0, VISIBLE_MATCHES).map((code) => (
            <li key={code}>
              <button type="button" onClick={() => add(code)}>
                {code}
              </button>
            </li>
          ))}
          {!matches.length ? (
            <li className="field-hint">Ningún motivo coincide con «{search.trim()}».</li>
          ) : null}
          {matches.length > VISIBLE_MATCHES ? (
            <li className="field-hint">
              y {matches.length - VISIBLE_MATCHES} más: afina la búsqueda.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
