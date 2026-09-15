'use client';

import type { StatementReviewQuery } from './statement-review.api';
import { REVIEW_PRIORITY_LABEL } from './statement-review';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';

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
      <Field label={'Estado'} tooltip="Filtra la cola por si alguien ya reclamó el caso.">
        <OptionSelect
          name="estado"
          value={value.status ?? ''}
          onChange={(valor) =>
            actualizar({ status: (valor || undefined) as StatementReviewQuery['status'] })
          }
          options={[
            {
              value: '',
              label: 'Todos',
              description: 'Sin filtrar: casos sin reclamar y en revisión.',
            },
            {
              value: 'PENDING_REVIEW',
              label: 'Sin reclamar',
              description: 'Nadie ha reclamado todavía el caso.',
            },
            {
              value: 'IN_REVIEW',
              label: 'En revisión',
              description: 'Una persona ya tiene reclamado el caso.',
            },
          ]}
        />
      </Field>

      <Field
        label={'Prioridad'}
        tooltip="Filtra la cola por la prioridad que publica el motor para cada caso."
      >
        <OptionSelect
          name="prioridad"
          value={value.priority ? String(value.priority) : ''}
          onChange={(valor) => actualizar({ priority: valor ? Number(valor) : undefined })}
          options={[
            {
              value: '',
              label: 'Todas',
              description: 'Sin filtrar: casos de cualquier prioridad.',
            },
            ...[1, 2, 3].map((nivel) => ({
              value: String(nivel), // sin-ayuda: el nombre del nivel ya dice el orden de la cola
              label: REVIEW_PRIORITY_LABEL[nivel],
            })),
          ]}
        />
      </Field>

      <Field label="Banco" tooltip="Código de la entidad para acotar la cola de revisión.">
        <input
          value={value.bank ?? ''}
          placeholder="Código de entidad"
          onChange={(evento) => actualizar({ bank: evento.target.value.trim() })}
        />
      </Field>

      <Field label="Desde" tooltip="Fecha inicial de los casos que se muestran.">
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
      </Field>

      <Field label="Hasta" tooltip="Fecha final de los casos que se muestran.">
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
      </Field>

      {activos ? (
        <button type="button" className="button button-ghost" onClick={() => onChange({})}>
          Quitar filtros
        </button>
      ) : null}
    </div>
  );
}
