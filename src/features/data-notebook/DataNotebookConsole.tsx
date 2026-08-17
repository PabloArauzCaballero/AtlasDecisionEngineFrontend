'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DatasetPanel } from './DatasetPanel';
import { COMENTARIO, LENGUAJES, ORDEN_LENGUAJES } from './language-catalog';
import { NotebookCellView } from './NotebookCellView';
import { NotebookInsertBar } from './NotebookInsertBar';
import { NotebookHistoryPanel } from './NotebookHistoryPanel';
import { RuntimeStatusBanner } from './RuntimeStatusBanner';
import { restaurarCeldas } from './notebook-restore';
import { NotebookSaveBar } from './NotebookSaveBar';
import { fetchNotebookPage, type NotebookPage } from './notebook.api';
import type { NotebookDocument } from './notebook-documents.api';
import { esDelMotor, fetchEnginePage } from './engine-datasets';
import { useNotebookSources } from './useNotebookSources';
import { useNotebookCells } from './useNotebookCells';
import { useNotebookRunner } from './useNotebookRunner';

/**
 * El cuaderno de datos.
 *
 * Lo que gobierna el diseño es el reparto: los DATOS los sirve AtlasBackend, ya acotados por
 * inquilino y enmascarados; el CÓDIGO corre en esta pestaña y en ningún otro sitio. El único
 * endpoint que recibe código es el del historial, y lo GUARDA sin interpretarlo jamás: abrir un
 * cuaderno de análisis no le añade al backend una superficie de ejecución remota, que es el
 * riesgo que suele traer una herramienta con esta forma.
 */
export function DataNotebookConsole({ documento }: { documento: NotebookDocument }) {
  const [datasetCode, setDatasetCode] = useState<string>(documento.datasetCode ?? '');
  const [page, setPage] = useState(1);
  const cuaderno = useNotebookCells();
  const { clearOutcomes, replaceCells } = cuaderno;

  /** Qué dataset y qué página estaban cargados la última vez, para distinguir un cambio REAL. */
  const ultimaCarga = useRef(`${documento.datasetCode ?? ''}|1`);

  /*
   * El avance guardado se restaura UNA vez, al abrir el cuaderno.
   *
   * Depende de `documento.id` y no del objeto entero: al guardar, la respuesta trae un documento
   * nuevo con las mismas celdas y volver a plantarlas pisaría lo que se haya escrito desde
   * entonces. El identificador sólo cambia cuando de verdad se abre otro cuaderno.
   */
  useEffect(() => {
    replaceCells(restaurarCeldas(documento.cells));
    setDatasetCode(documento.datasetCode ?? '');
    setPage(1);
    // La marca se reinicia con el dataset de ESTE cuaderno: si no, abrir un segundo cuaderno se
    // vería como un cambio de dataset y le borraría el avance nada más traerlo.
    ultimaCarga.current = `${documento.datasetCode ?? ''}|1`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documento.id, replaceCells]);

  const { catalogo, catalogoMotor, datasets, descartadas } = useNotebookSources();

  useEffect(() => {
    if (!datasetCode && datasets.length) setDatasetCode(datasets[0].code);
  }, [datasets, datasetCode]);

  const datos = useQuery({
    queryKey: ['data-notebook', 'rows', datasetCode, page],
    queryFn: ({ signal }) => {
      const consulta = { page, pageSize: catalogo.data?.limits.defaultPageSize ?? 100 };
      return esDelMotor(datasetCode)
        ? fetchEnginePage(datasetCode, consulta, signal)
        : fetchNotebookPage(datasetCode, consulta, signal);
    },
    enabled: Boolean(datasetCode),
    placeholderData: (previa) => previa,
  });

  /*
   * Cambiar de dataset o de página descarta los resultados: dejan de corresponder a lo cargado.
   *
   * La comparación con lo ANTERIOR no es un adorno de rendimiento, es lo que separa dos casos que
   * el efecto veía iguales. Al abrir un cuaderno guardado, `datasetCode` pasa de vacío al suyo y
   * la página a la 1: eso disparaba este efecto y borraba el avance recién restaurado, justo lo
   * que se acababa de traer. Un cambio de verdad —alguien elige otro dataset— sí lo descarta,
   * porque un número calculado sobre otras filas junto a las nuevas es la peor lectura posible.
   */
  useEffect(() => {
    const actual = `${datasetCode}|${page}`;
    if (ultimaCarga.current === actual) return;
    ultimaCarga.current = actual;
    clearOutcomes();
  }, [datasetCode, page, clearOutcomes]);

  /** Los nombres de columna de la página cargada: lo que el autocompletado ofrece del dataset. */
  const columnasNombres = useMemo(
    () => datos.data?.columns.map((columna) => columna.name) ?? [],
    [datos.data],
  );

  /** Las filas y columnas que ve una celda al ejecutarse: exactamente la página cargada. */
  const datosDeCelda = useCallback(() => {
    const actual: NotebookPage | undefined = datos.data;
    return {
      rows: (actual?.rows ?? []) as Record<string, unknown>[],
      columns: actual?.columns.map((columna) => columna.name) ?? [],
    };
  }, [datos.data]);

  const { ejecutar, reusar, simbolosHasta, motores, historialVersion } = useNotebookRunner({
    cuaderno,
    datasetCode,
    page,
    datosDeCelda,
    columnasNombres,
  });

  if (catalogo.isPending) {
    return <p className="notebook-loading">Cargando el catálogo de datos…</p>;
  }

  if (catalogo.isError || !catalogo.data) {
    return (
      <p className="notebook-error" role="alert">
        No fue posible leer el catálogo de datasets de AtlasBackend. Comprueba que el servicio
        responde y que tu sesión sigue activa.
      </p>
    );
  }

  const columnas = datos.data?.columns ?? [];

  return (
    <div className="notebook">
      <DatasetPanel
        catalog={catalogo.data}
        datasets={datasets}
        omitted={descartadas}
        engineUnavailable={catalogoMotor.isError}
        selected={datasetCode}
        onSelect={(code) => {
          setDatasetCode(code);
          setPage(1);
        }}
        page={datos.data ?? null}
        loading={datos.isFetching}
        error={datos.isError ? 'No se pudo cargar esta página del dataset.' : null}
        onPage={setPage}
        onReload={() => void datos.refetch()}
      />

      <NotebookSaveBar documento={documento} datasetCode={datasetCode} cells={cuaderno.cells} />

      {/*
       * Un aviso por intérprete, y sólo cuando ese intérprete se ha usado: `phase: 'idle'` no
       * pinta nada. Un cuaderno que abre con dos franjas anunciando dos lenguajes que nadie ha
       * pedido todavía empuja hacia abajo lo único que importa al entrar, que son los datos.
       */}
      <RuntimeStatusBanner motor="python" status={motores.python} />
      <RuntimeStatusBanner motor="r" status={motores.r} />

      <div className="notebook__cells">
        {/* La primera franja encabeza el cuaderno: es la única forma de anteponer algo a la celda 1. */}
        <NotebookInsertBar
          afterId={null}
          posicion={1}
          onInsert={(kind, language) => cuaderno.insertCell(null, kind, language)}
        />
        {cuaderno.cells.map((celda, indice) => (
          <Fragment key={celda.id}>
            <NotebookCellView
              cell={celda}
              index={indice}
              total={cuaderno.cells.length}
              policies={columnas}
              simbolos={simbolosHasta(indice)}
              onChange={(source) => cuaderno.setSource(celda.id, source)}
              onRun={() => void ejecutar(celda.id, celda.language, celda.source)}
              onDelete={() => cuaderno.removeCell(celda.id)}
              onDuplicate={() => cuaderno.duplicateCell(celda.id)}
              onMove={(direccion) => cuaderno.moveCell(celda.id, direccion)}
              onLanguage={(language) => cuaderno.setLanguage(celda.id, language)}
            />
            <NotebookInsertBar
              afterId={celda.id}
              posicion={indice + 2}
              onInsert={(kind, language) => cuaderno.insertCell(celda.id, kind, language)}
            />
          </Fragment>
        ))}
      </div>

      <NotebookHistoryPanel version={historialVersion} onReuse={reusar} />

      {/* Uno por lenguaje, desde el mismo catálogo que alimenta la franja de inserción y la barra
          de la celda: los tres sitios donde se elige lenguaje dicen lo mismo y se ven igual. */}
      <div className="notebook__add">
        {ORDEN_LENGUAJES.map((lenguaje) => {
          const { label, Icon } = LENGUAJES[lenguaje];
          return (
            <button
              key={lenguaje}
              type="button"
              className="button"
              data-language={lenguaje}
              onClick={() => cuaderno.addCell(lenguaje)}
            >
              <Plus aria-hidden="true" size={14} />
              <Icon aria-hidden="true" size={14} /> Celda de {label}
            </button>
          );
        })}
        <button
          type="button"
          className="button"
          data-language="markdown"
          onClick={() => cuaderno.addMarkdown()}
        >
          <Plus aria-hidden="true" size={14} />
          <COMENTARIO.Icon aria-hidden="true" size={14} /> {COMENTARIO.label}
        </button>
      </div>
    </div>
  );
}
