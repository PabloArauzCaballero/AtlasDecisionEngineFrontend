'use client';

import { useQuery } from '@tanstack/react-query';
import { History, RotateCcw } from 'lucide-react';
import { fetchNotebookHistory, type NotebookHistoryRow } from './notebook.api';

interface NotebookHistoryPanelProps {
  /** Se recarga cuando cambia: cada ejecución añade una entrada nueva. */
  version: number;
  onReuse: (row: NotebookHistoryRow) => void;
}

/**
 * El historial: qué se preguntó, nunca qué se obtuvo.
 *
 * Aquí sólo hay código, dataset y unas medidas. No hay resultados y no los habrá: el backend no
 * tiene columna donde quepan y rechaza la petición que los mande. Guardarlos habría convertido
 * esta lista en una segunda copia de datos personales fuera de `read_api`, sin enmascarado y sin
 * caducidad — el mayor problema de privacidad del módulo, creado justamente por la función que se
 * añadió para dar trazabilidad.
 *
 * Por eso el botón dice «Reusar» y no «Ver resultado»: lo que se recupera es la pregunta, y se
 * vuelve a ejecutar contra los datos de HOY. Para auditar, además, es lo correcto.
 */
export function NotebookHistoryPanel({ version, onReuse }: NotebookHistoryPanelProps) {
  const historial = useQuery({
    queryKey: ['data-notebook', 'history', version],
    queryFn: ({ signal }) => fetchNotebookHistory(signal),
  });

  return (
    <section className="notebook-history" aria-label="Historial de consultas">
      <header className="notebook-history__head">
        <h3 className="notebook-history__title">
          <History aria-hidden="true" size={14} /> Historial
        </h3>
        <p className="notebook-history__note">
          Se guarda el código, nunca el resultado. Es tuyo: no muestra el de otras personas.
        </p>
      </header>

      {historial.isPending ? <p className="notebook-history__empty">Cargando…</p> : null}

      {historial.isError ? (
        <p className="notebook-history__empty" role="alert">
          No se pudo leer el historial.
        </p>
      ) : null}

      {historial.data && historial.data.length === 0 ? (
        <p className="notebook-history__empty">Todavía no has ejecutado ninguna celda.</p>
      ) : null}

      <ul className="notebook-history__list">
        {(historial.data ?? []).map((fila) => (
          <li
            key={fila.id}
            className={`notebook-history__item notebook-history__item--${fila.status}`}
          >
            <div className="notebook-history__meta">
              <span className="notebook-history__lang">
                {fila.language === 'python' ? 'Python' : 'JavaScript'}
              </span>
              {fila.datasetCode ? (
                <span className="notebook-history__dataset">{fila.datasetCode}</span>
              ) : null}
              {/* El número de filas distingue una exploración de una extracción sin guardar ni una. */}
              {fila.rowCount !== null ? <span>{fila.rowCount} filas</span> : null}
              {fila.durationMs !== null ? <span>{fila.durationMs} ms</span> : null}
              <time dateTime={fila.createdAt}>
                {new Date(fila.createdAt).toLocaleString('es-BO')}
              </time>
            </div>
            <pre className="notebook-history__source">{fila.source}</pre>
            {fila.errorMessage ? (
              <p className="notebook-history__error">{fila.errorMessage}</p>
            ) : null}
            <button type="button" className="button" onClick={() => onReuse(fila)}>
              <RotateCcw aria-hidden="true" size={14} /> Reusar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
