'use client';

import { Database, EyeOff, RefreshCw, Scissors, ShieldAlert } from 'lucide-react';
import { esDelMotor } from './engine-datasets';
import type { NotebookCatalog, NotebookDataset, NotebookPage } from './notebook.api';
import { ResultTable } from './ResultTable';

interface DatasetPanelProps {
  catalog: NotebookCatalog;
  /**
   * Los datasets de las DOS fuentes, ya unidos.
   *
   * No se leen de `catalog.datasets` porque ése es sólo el catálogo de AtlasBackend; las vistas
   * gobernadas del motor llegan por otra llamada. `catalog` se sigue usando para los techos, que
   * son los del transporte de AtlasBackend.
   */
  datasets: NotebookDataset[];
  /**
   * Vistas que existen en alguna de las dos bases y que su backend NO sirve, con el motivo.
   *
   * Es el reverso de que el catálogo se descubra solo. Mientras las listas se escribían a mano,
   * una vista que faltaba era siempre lo mismo —nadie la había añadido al código— y se arreglaba
   * ahí. Ahora una vista puede estar publicada y aun así no servirse, y sin esta lista los dos
   * casos se ven idénticos desde la pantalla: ausencia total, sin nada que consultar.
   */
  omitted: { name: string; reason: string }[];
  /** El catálogo del motor no contestó: se dice, no se esconde. */
  engineUnavailable: boolean;
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
  datasets,
  omitted,
  engineUnavailable,
  selected,
  onSelect,
  page,
  loading,
  error,
  onPage,
  onReload,
}: DatasetPanelProps) {
  const dataset = datasets.find((candidato) => candidato.code === selected);
  /*
   * Agrupados por origen, y con el origen escrito.
   *
   * Las dos bases hablan de cosas distintas —una de personas y casos, otra de decisiones— y en una
   * lista plana `ejecuciones` y `v_customer_overview_v1` parecen dos tablas del mismo sitio. Quien
   * cruce ambas sin saberlo estará uniendo por identificadores que no significan lo mismo.
   */
  const deAtlasBackend = datasets.filter((candidato) => !esDelMotor(candidato.code));
  const delMotor = datasets.filter((candidato) => esDelMotor(candidato.code));

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
            <optgroup label="AtlasBackend · clientes, casos y bitácora">
              {deAtlasBackend.map((candidato) => (
                <option key={candidato.code} value={candidato.code}>
                  {candidato.label}
                </option>
              ))}
            </optgroup>
            {delMotor.length ? (
              <optgroup label="Motor de decisión · decisiones y riesgo">
                {delMotor.map((candidato) => (
                  <option key={candidato.code} value={candidato.code}>
                    {candidato.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        <button type="button" className="button" onClick={onReload} disabled={loading}>
          <RefreshCw aria-hidden="true" size={14} /> Recargar
        </button>
      </header>

      {dataset ? <p className="notebook-dataset__description">{dataset.description}</p> : null}

      {engineUnavailable ? (
        /*
         * Media casa que falta se DICE. Sin este aviso, quien no tenga permiso de consola SQL —o
         * quien mire mientras el motor no responde— vería una lista con sólo los datasets de
         * AtlasBackend y la leería como el catálogo completo: buscaría las decisiones donde no
         * están y concluiría que no hay.
         */
        <p className="notebook-dataset__aviso-motor" role="status">
          <ShieldAlert aria-hidden="true" size={14} /> No se pudieron listar las vistas del motor de
          decisión (decisiones, riesgo, catálogo, desenlaces y auditoría). Se sigue trabajando con
          las de AtlasBackend; comprueba tu permiso de consola SQL o si el motor responde.
        </p>
      ) : null}

      {omitted.length ? (
        /*
         * En un <details> cerrado a propósito.
         *
         * No es un aviso para quien viene a analizar: no hay nada que pueda hacer con él y encima
         * de la tabla competiría con lo que sí cambia sus conclusiones (el enmascarado, el
         * recorte). Es para quien publicó una vista y no la encuentra, y esa persona SÍ la busca.
         * Escondido del todo daría igual que no estuviera; abierto, gritaría un problema ajeno.
         */
        <details className="notebook-dataset__descartadas">
          <summary>
            <ShieldAlert aria-hidden="true" size={14} /> {omitted.length} vista
            {omitted.length === 1 ? '' : 's'} publicada{omitted.length === 1 ? '' : 's'} que no se
            sirve{omitted.length === 1 ? '' : 'n'}
          </summary>
          <ul>
            {omitted.map((entrada) => (
              <li key={entrada.name}>
                <code>{entrada.name}</code> — {entrada.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

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
