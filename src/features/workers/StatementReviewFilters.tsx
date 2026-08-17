'use client';

import type { StatementReviewQuery } from './statement-review.api';
import { REVIEW_PRIORITY_LABEL } from './statement-review';

/**
 * Filtros de la cola, todos servidos por el motor.
 *
 * Se separan de las pestañas de categoría porque responden a preguntas
 * distintas: la pestaña es «qué clase de duda», y esto es «de quién, de cuándo y
 * cómo de urgente». Mezclarlos en una barra sola convertía la elección de
 * categoría —que es lo que se hace siempre— en un desplegable más.
 *
 * Todos son opcionales y ninguno se aplica en el cliente: el motor acota, ordena
 * y pagina. Filtrar aquí sobre la página cargada daría resultados que dependen
 * del tamaño de página, que es la clase de error que nadie reporta porque la
 * pantalla sigue funcionando.
 */
export function StatementReviewFilters({
  value,
  onChange,
}: {
  value: StatementReviewQuery;
  onChange: (siguiente: StatementReviewQuery) => void;
}) {
  function actualizar(parche: Partial<StatementReviewQuery>) {
    const siguiente = { ...value, ...parche };
    // Una cadena vacía en la URL filtra por «cadena vacía» y devuelve cero
    // casos; lo que quiere decir quien vacía un campo es «sin filtro».
    for (const clave of Object.keys(siguiente) as Array<keyof StatementReviewQuery>) {
      if (siguiente[clave] === '' || siguiente[clave] === undefined) delete siguiente[clave];
    }
    onChange(siguiente);
  }

  const activos = Object.keys(value).length > 0;

  return (
    <div className="revision-filtros">
      <label className="field">
        <span>Estado</span>
        <select
          value={value.status ?? ''}
          onChange={(evento) =>
            actualizar({
              status: (evento.target.value || undefined) as StatementReviewQuery['status'],
            })
          }
        >
          <option value="">Todos</option>
          <option value="PENDING_REVIEW">Sin reclamar</option>
          <option value="IN_REVIEW">En revisión</option>
        </select>
      </label>

      <label className="field">
        <span>Prioridad</span>
        <select
          value={value.priority ? String(value.priority) : ''}
          onChange={(evento) =>
            actualizar({ priority: evento.target.value ? Number(evento.target.value) : undefined })
          }
        >
          <option value="">Todas</option>
          {[1, 2, 3].map((nivel) => (
            <option key={nivel} value={String(nivel)}>
              {REVIEW_PRIORITY_LABEL[nivel]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Banco</span>
        <input
          value={value.bank ?? ''}
          placeholder="Código de entidad"
          onChange={(evento) => actualizar({ bank: evento.target.value.trim() })}
        />
      </label>

      <label className="field">
        <span>Desde</span>
        <input
          type="date"
          value={value.dateFrom?.slice(0, 10) ?? ''}
          onChange={(evento) =>
            actualizar({
              dateFrom: evento.target.value
                ? new Date(`${evento.target.value}T00:00:00`).toISOString()
                : undefined,
            })
          }
        />
      </label>

      <label className="field">
        <span>Hasta</span>
        <input
          type="date"
          value={value.dateTo?.slice(0, 10) ?? ''}
          onChange={(evento) =>
            actualizar({
              // Fin del día y no medianoche: con `T00:00:00` el rango «hasta hoy»
              // excluye todo lo de hoy, que es el filtro que más se usa.
              dateTo: evento.target.value
                ? new Date(`${evento.target.value}T23:59:59`).toISOString()
                : undefined,
            })
          }
        />
      </label>

      {activos ? (
        <button type="button" className="button button-ghost" onClick={() => onChange({})}>
          Quitar filtros
        </button>
      ) : null}
    </div>
  );
}
