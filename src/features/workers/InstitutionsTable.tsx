'use client';

import { Pencil, Power, PowerOff } from 'lucide-react';
import {
  INSTITUTION_KIND_LABELS,
  LICENSE_STATUS_LABELS,
  type FinancialInstitution,
} from './institutions.api';

/**
 * El padrón, agrupado por tipo de entidad.
 *
 * Agrupado y no como una tabla plana de 67 filas porque así es como se lee la
 * nómina de ASFI y como se piensa el dominio: los bancos múltiples son once y se
 * revisan uno a uno; las cooperativas son cuarenta y una y se revisan como
 * bloque. Una lista alfabética mezclaría el Banco Nacional con la cooperativa de
 * Aiquile y haría imposible responder de un vistazo «¿están todos los bancos?».
 *
 * **La licencia y la baja son dos cosas distintas y se enseñan distinto.** Una
 * entidad sin licencia sigue reconociendo documentos y los manda a revisión; una
 * dada de baja deja de reconocerlos y los suyos pasan a rechazarse. Verlas
 * iguales haría creer que desactivar una entidad es la forma de marcarla como
 * intervenida, que es justo lo contrario de lo que hace.
 */
export interface InstitutionsTableProps {
  entidades: readonly FinancialInstitution[];
  onEditar: (entidad: FinancialInstitution) => void;
  onDesactivar: (entidad: FinancialInstitution) => void;
  onReactivar: (entidad: FinancialInstitution) => void;
}

/** El orden en que ASFI publica su nómina, y en el que se espera leerla. */
const ORDEN_DE_TIPOS = [
  'MULTIPLE_BANK',
  'PYME_BANK',
  'STATE_BANK',
  'DEVELOPMENT_BANK',
  'HOUSING_ENTITY',
  'COOPERATIVE',
  'DEVELOPMENT_IFD',
] as const;

export function InstitutionsTable({
  entidades,
  onEditar,
  onDesactivar,
  onReactivar,
}: InstitutionsTableProps) {
  if (entidades.length === 0) {
    return (
      <p className="entidad-vacio">
        El padrón está vacío. Sin entidades, el motor no puede atribuir ningún extracto y los
        rechaza todos como «emisor no reconocido»: siembra la nómina de ASFI antes de procesar nada.
      </p>
    );
  }

  return (
    <div className="entidad-grupos">
      {ORDEN_DE_TIPOS.map((tipo) => {
        const grupo = entidades.filter((entidad) => entidad.kind === tipo);
        if (grupo.length === 0) return null;
        return (
          <section key={tipo} className="entidad-grupo">
            <h4 className="entidad-grupo-titulo">
              {INSTITUTION_KIND_LABELS[tipo]} <span className="entidad-conteo">{grupo.length}</span>
            </h4>
            <table className="entidad-tabla">
              <thead>
                <tr>
                  <th scope="col">Sigla</th>
                  <th scope="col">Razón social</th>
                  <th scope="col">Licencia</th>
                  <th scope="col">Marcadores</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupo.map((entidad) => (
                  <tr key={entidad.code} data-inactiva={entidad.isActive ? undefined : 'si'}>
                    <th scope="row" className="entidad-sigla">
                      {entidad.code}
                    </th>
                    <td>
                      {entidad.name}
                      {entidad.note !== null && entidad.note !== '' ? (
                        <small className="entidad-nota">{entidad.note}</small>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className="entidad-licencia"
                        data-estado={entidad.licenseStatus.toLowerCase()}
                      >
                        {LICENSE_STATUS_LABELS[entidad.licenseStatus]}
                      </span>
                      {entidad.isActive ? null : (
                        <span className="entidad-baja">Dada de baja · no reconoce documentos</span>
                      )}
                    </td>
                    <td className="entidad-marcadores">
                      {/* Se enseña el recuento y el primero, no los cinco: la
                          columna existe para detectar la entidad que se quedó
                          sin marcadores útiles, no para leer expresiones. */}
                      <span>{entidad.markers.length}</span>
                      <code>{entidad.markers[0] ?? '—'}</code>
                    </td>
                    <td className="entidad-acciones">
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => onEditar(entidad)}
                      >
                        <Pencil size={14} aria-hidden="true" /> Editar
                      </button>
                      {entidad.isActive ? (
                        <button
                          type="button"
                          className="button button-small"
                          onClick={() => onDesactivar(entidad)}
                        >
                          <PowerOff size={14} aria-hidden="true" /> Dar de baja
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button button-small"
                          onClick={() => onReactivar(entidad)}
                        >
                          <Power size={14} aria-hidden="true" /> Reactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
