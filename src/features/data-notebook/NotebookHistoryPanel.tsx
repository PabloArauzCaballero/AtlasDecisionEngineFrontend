'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, History, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { LENGUAJES } from './language-catalog';
import { fetchNotebookHistory, type NotebookHistoryRow } from './notebook.api';

/**
 * Cómo se llama el idioma de una entrada del historial.
 *
 * La tabla la comparte con la consola SQL, así que aquí aparecen valores —`sql`— que no son celdas
 * del cuaderno. Lo desconocido se enseña TAL CUAL: inventarle un nombre de los que sí conocemos
 * convertiría este panel, que es evidencia, en una afirmación falsa sobre qué se ejecutó.
 */
function rotuloDeIdioma(language: string): string {
  if (language === 'sql') return 'SQL';
  if (language in LENGUAJES) return LENGUAJES[language as keyof typeof LENGUAJES].label;
  return language;
}

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
 *
 * ## Plegado y paginado
 *
 * Va PLEGADO de entrada. El historial crece con cada celda ejecutada, y desplegado empujaba las
 * celdas fuera de la pantalla en una sesión de trabajo normal: la lista de lo que hiciste antes
 * tapando aquello en lo que estás. El encabezado dice cuántas entradas hay, que es lo que permite
 * decidir si merece la pena abrirlo sin abrirlo.
 *
 * Y se pide por páginas al servidor, no se trae entero para cortarlo aquí: quien lleva mil celdas
 * ejecutadas descargaba mil códigos fuente para enseñar diez.
 */

/** Entradas por página. Diez caben en pantalla sin desplazar y cubren la sesión reciente. */
const POR_PAGINA = 10;

export function NotebookHistoryPanel({ version, onReuse }: NotebookHistoryPanelProps) {
  const [abierto, setAbierto] = useState(false);
  const [pagina, setPagina] = useState(0);

  const historial = useQuery({
    queryKey: ['data-notebook', 'history', version, pagina],
    queryFn: ({ signal }) =>
      fetchNotebookHistory({ limit: POR_PAGINA, offset: pagina * POR_PAGINA }, signal),
    // Sólo se pregunta con el panel abierto: plegado, el historial no se ve y pedirlo sería gastar
    // una petición por cada celda ejecutada para llenar una lista que nadie está mirando.
    enabled: abierto,
    // Al cambiar de página se conserva la anterior mientras llega la nueva: sin esto la lista
    // parpadea a «Cargando…» y el panel entero cambia de alto en cada pulsación.
    placeholderData: keepPreviousData,
  });

  const total = historial.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const filas = historial.data?.rows ?? [];

  return (
    <section className="notebook-history" aria-label="Historial de consultas">
      <header className="notebook-history__head">
        <button
          type="button"
          className="notebook-history__toggle"
          onClick={() => setAbierto((previo) => !previo)}
          aria-expanded={abierto}
          aria-controls="notebook-history-cuerpo"
        >
          {abierto ? (
            <ChevronDown aria-hidden="true" size={14} />
          ) : (
            <ChevronRight aria-hidden="true" size={14} />
          )}
          <History aria-hidden="true" size={14} />
          <span className="notebook-history__title">Historial</span>
          {abierto && total > 0 ? <span className="notebook-history__cuenta">{total}</span> : null}
        </button>
        <p className="notebook-history__note">
          Se guarda el código, nunca el resultado. Es tuyo: no muestra el de otras personas.
        </p>
      </header>

      {abierto ? (
        <div id="notebook-history-cuerpo">
          {historial.isPending ? <p className="notebook-history__empty">Cargando…</p> : null}

          {historial.isError ? (
            <p className="notebook-history__empty" role="alert">
              No se pudo leer el historial.
            </p>
          ) : null}

          {historial.data && total === 0 ? (
            <p className="notebook-history__empty">Todavía no has ejecutado ninguna celda.</p>
          ) : null}

          <ul className="notebook-history__list">
            {filas.map((fila) => (
              <li
                key={fila.id}
                className={`notebook-history__item notebook-history__item--${fila.status}`}
              >
                <div className="notebook-history__meta">
                  {/*
                   * El rótulo sale del catálogo, con la misma marca de color que la celda.
                   *
                   * El ternario que había aquí decía «JavaScript» a todo lo que no fuera Python, así
                   * que en cuanto entró R el historial empezó a MENTIR sobre en qué se ejecutó cada
                   * consulta — y este panel es evidencia de auditoría, no adorno. La consola SQL
                   * escribe en la misma tabla, así que un idioma que este cuaderno no conoce se
                   * enseña tal cual en vez de disfrazarse del último de la lista.
                   */}
                  <span className="notebook-history__lang" data-language={fila.language}>
                    <span className="notebook-cell__marca" aria-hidden="true" />
                    {rotuloDeIdioma(fila.language)}
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

          {/* La paginación aparece sólo cuando hay más de una página: dos botones apagados bajo una
              lista de tres entradas es ruido que sugiere que falta algo. */}
          {total > POR_PAGINA ? (
            <nav className="notebook-history__paginacion" aria-label="Páginas del historial">
              <button
                type="button"
                className="button"
                onClick={() => setPagina((previa) => Math.max(0, previa - 1))}
                disabled={pagina === 0 || historial.isFetching}
              >
                Anterior
              </button>
              <span aria-live="polite">
                Página {pagina + 1} de {paginas}
              </span>
              <button
                type="button"
                className="button"
                onClick={() => setPagina((previa) => Math.min(paginas - 1, previa + 1))}
                disabled={pagina >= paginas - 1 || historial.isFetching}
              >
                Siguiente
              </button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
