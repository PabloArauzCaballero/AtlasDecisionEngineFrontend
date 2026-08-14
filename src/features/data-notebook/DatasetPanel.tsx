'use client';

import { Database, EyeOff, RefreshCw, Scissors, ShieldAlert } from 'lucide-react';
import type { NotebookCatalog, NotebookPage } from './notebook.api';
import { ResultTable } from './ResultTable';

interface DatasetPanelProps {
  catalog: NotebookCatalog;
  selected: string;
  onSelect: (code: string) => void;
  page: NotebookPage | null;
  loading: boolean;
  error: string | null;
  onPage: (page: number) => void;
  onReload: () => void;
}

/** 8388608 -> «8 MB». El techo se dice en la unidad en la que se piensa, no en bytes. */
function formatearMegas(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * El dataset que el cuaderno tiene cargado, y lo que hay que saber de él antes de analizarlo.
 *
 * Lo que se enseña arriba del todo no es la tabla: es CUÁNTAS filas se cargaron, si vienen
 * enmascaradas y si la página se recortó. Las tres cosas cambian lo que las conclusiones
 * significan. Analizar 100 filas creyendo que son el universo produce un número correcto sobre una
 * muestra que nadie eligió; agrupar por una columna enmascarada junta a personas distintas bajo la
 * misma máscara; y un recorte silencioso hace las dos cosas a la vez sin que nada falle.
 */
export function DatasetPanel({
  catalog,
  selected,
  onSelect,
  page,
  loading,
  error,
  onPage,
  onReload,
}: DatasetPanelProps) {
  const dataset = catalog.datasets.find((candidato) => candidato.code === selected);

  return (
    <section className="notebook-dataset" aria-label="Datos cargados en el cuaderno">
      <header className="notebook-dataset__head">
        <label className="notebook-dataset__picker">
          <span className="notebook-dataset__label">
            <Database aria-hidden="true" size={14} /> Dataset
          </span>
          <select
            value={selected}
            onChange={(evento) => onSelect(evento.target.value)}
            disabled={loading}
          >
            {catalog.datasets.map((candidato) => (
              <option key={candidato.code} value={candidato.code}>
                {candidato.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button" onClick={onReload} disabled={loading}>
          <RefreshCw aria-hidden="true" size={14} /> Recargar
        </button>
      </header>

      {dataset ? <p className="notebook-dataset__description">{dataset.description}</p> : null}

      {page?.masked ? (
        <p className="notebook-dataset__notice">
          <EyeOff aria-hidden="true" size={14} />
          Hay columnas enmascaradas. Sirven para contar y agrupar por el resto de campos, pero dos
          personas distintas pueden compartir la misma máscara: no las uses como clave.
        </p>
      ) : null}

      {/*
       * El recorte por tamaño se dice SIEMPRE que ocurre, y con el número de filas que faltan.
       * Una página truncada en silencio produce un análisis sobre una muestra que nadie eligió:
       * el total sigue diciendo veinte mil, la tabla enseña unas cuantas, y el promedio que salga
       * de ahí parece un promedio de todo.
       */}
      {page?.droppedRows ? (
        <p className="notebook-dataset__notice" role="status">
          <Scissors aria-hidden="true" size={14} />
          Esta página pesaba más del techo de {formatearMegas(catalog.limits.maxResponseBytes)} y se
          recortó: llegaron {page.rows.length} filas y quedaron {page.droppedRows} fuera. Baja las
          filas por página para verlas todas.
        </p>
      ) : null}

      {error ? (
        <p className="notebook-dataset__error" role="alert">
          <ShieldAlert aria-hidden="true" size={14} /> {error}
        </p>
      ) : null}

      {loading && !page ? <p className="notebook-dataset__loading">Cargando el dataset…</p> : null}

      {page ? (
        <>
          <p className="notebook-dataset__scope">
            El cuaderno ve las <strong>{page.rows.length}</strong> filas de esta página como{' '}
            <code>rows</code> y <code>df</code>. Cambia de página para analizar otra parte.
          </p>
          <ResultTable
            table={{ columns: page.columns.map((columna) => columna.name), rows: page.rows }}
            name={page.dataset.label}
            policies={page.columns}
            server={{
              page: page.page,
              pageSize: page.pageSize,
              total: page.total,
              totalIsExact: page.totalIsExact,
              onPage,
              loading,
            }}
          />
        </>
      ) : null}
    </section>
  );
}
