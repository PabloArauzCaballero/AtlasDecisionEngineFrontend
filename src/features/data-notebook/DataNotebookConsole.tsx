'use client';

import { useQuery } from '@tanstack/react-query';
import { Code2, FileCode2, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DatasetPanel } from './DatasetPanel';
import { NotebookCellView } from './NotebookCellView';
import { NotebookHistoryPanel } from './NotebookHistoryPanel';
import { PythonStatusBanner } from './PythonStatusBanner';
import {
  fetchNotebookCatalog,
  fetchNotebookPage,
  recordNotebookHistory,
  type NotebookHistoryRow,
  type NotebookPage,
} from './notebook.api';
import type { CellOutcome, NotebookLanguage, PythonStatus } from './notebook-types';
import { runJavaScriptCell } from './js-runtime';
import { bindPythonData, loadPythonRuntime, runPythonCell } from './python-runtime';
import { tableFromValue } from './notebook-export';
import { useNotebookCells } from './useNotebookCells';

/** La misma derivación que hace la vista: un DataFrame ya viene resuelto, un valor de JS no. */
function tablaDe(outcome: CellOutcome) {
  if (outcome.status !== 'ok') return undefined;
  return outcome.table ?? tableFromValue(outcome.value);
}

/**
 * El cuaderno de datos.
 *
 * Lo que gobierna el diseño es el reparto: los DATOS los sirve AtlasBackend, ya acotados por
 * inquilino y enmascarados; el CÓDIGO corre en esta pestaña y en ningún otro sitio. El único
 * endpoint que recibe código es el del historial, y lo GUARDA sin interpretarlo jamás: abrir un
 * cuaderno de análisis no le añade al backend una superficie de ejecución remota, que es el
 * riesgo que suele traer una herramienta con esta forma.
 */
export function DataNotebookConsole() {
  const [datasetCode, setDatasetCode] = useState<string>('');
  const [page, setPage] = useState(1);
  const [python, setPython] = useState<PythonStatus>({ phase: 'idle' });
  // Cambia con cada ejecución registrada y hace que el panel de historial vuelva a preguntar.
  const [historialVersion, setHistorialVersion] = useState(0);

  const cuaderno = useNotebookCells();
  const { clearOutcomes } = cuaderno;

  const catalogo = useQuery({
    queryKey: ['data-notebook', 'catalog'],
    queryFn: ({ signal }) => fetchNotebookCatalog(signal),
  });

  useEffect(() => {
    if (!datasetCode && catalogo.data?.datasets.length) {
      setDatasetCode(catalogo.data.datasets[0].code);
    }
  }, [catalogo.data, datasetCode]);

  const datos = useQuery({
    queryKey: ['data-notebook', 'rows', datasetCode, page],
    queryFn: ({ signal }) =>
      fetchNotebookPage(
        datasetCode,
        { page, pageSize: catalogo.data?.limits.defaultPageSize ?? 100 },
        signal,
      ),
    enabled: Boolean(datasetCode),
    placeholderData: (previa) => previa,
  });

  // Un resultado calculado sobre la página anterior deja de ser cierto en cuanto los datos cambian,
  // y dejarlo en pantalla junto a los datos nuevos es la forma más silenciosa de sacar una
  // conclusión equivocada.
  useEffect(() => {
    clearOutcomes();
  }, [datasetCode, page, clearOutcomes]);

  const datosDeCelda = useCallback(() => {
    const actual: NotebookPage | undefined = datos.data;
    return {
      rows: (actual?.rows ?? []) as Record<string, unknown>[],
      columns: actual?.columns.map((columna) => columna.name) ?? [],
    };
  }, [datos.data]);

  /**
   * Registra la celda y NO deja que el registro estropee la ejecución.
   *
   * Si el historial falla —el backend caído, un 403, la red— la celda ya se ejecutó y su resultado
   * está en pantalla. Propagar ese fallo convertiría un problema de trazabilidad en la pérdida del
   * trabajo de quien lo escribió, que es desproporcionado y además le enseñaría a desconfiar de la
   * herramienta por algo que no le pasó a sus datos.
   */
  const registrar = useCallback(
    async (language: NotebookLanguage, source: string, outcome: CellOutcome) => {
      try {
        await recordNotebookHistory({
          language,
          source,
          datasetCode: datasetCode || undefined,
          datasetPage: page,
          // La tabla se DERIVA igual que en la vista. Leer sólo `outcome.table` dejaba sin
          // `rowCount` a todas las celdas de JavaScript —su runtime devuelve el valor crudo y la
          // tabla se calcula al pintar—, y ese número es justo lo que distingue una exploración
          // de una extracción en el historial.
          rowCount: outcome.status === 'ok' ? tablaDe(outcome)?.rows.length : undefined,
          durationMs: outcome.durationMs,
          status: outcome.status,
          errorMessage: outcome.status === 'error' ? outcome.error.slice(0, 500) : undefined,
        });
        setHistorialVersion((previa) => previa + 1);
      } catch {
        // Silencio deliberado: ver el comentario de arriba.
      }
    },
    [datasetCode, page],
  );

  /**
   * Recupera una celda del historial como una celda NUEVA al final, sin ejecutarla.
   *
   * No se ejecuta sola a propósito: lo que se recupera es una pregunta escrita en otro momento, y
   * los datos de hoy pueden ser otros. Que la persona la lea antes de pulsar es la diferencia
   * entre reusar una consulta y repetirla a ciegas.
   */
  const reusar = useCallback(
    (fila: NotebookHistoryRow) => {
      cuaderno.addCell(fila.language === 'python' ? 'python' : 'javascript', fila.source);
    },
    [cuaderno],
  );

  const ejecutar = useCallback(
    async (id: string, language: NotebookLanguage, source: string) => {
      cuaderno.startRun(id);
      const entrada = datosDeCelda();

      const terminar = (outcome: CellOutcome) => {
        cuaderno.finishRun(id, outcome);
        void registrar(language, source, outcome);
      };

      if (language === 'javascript') {
        terminar(await runJavaScriptCell(source, entrada));
        return;
      }

      try {
        const pyodide = await loadPythonRuntime((detalle) =>
          setPython({ phase: 'loading', detail: detalle }),
        );
        setPython({ phase: 'ready', packages: ['pandas', 'numpy'] });
        await bindPythonData(pyodide, entrada);
        terminar(await runPythonCell(pyodide, source));
      } catch (error) {
        const razon = error instanceof Error ? error.message : 'No se pudo arrancar Python.';
        setPython({ phase: 'unavailable', reason: razon });
        terminar({ status: 'error', error: razon, logs: [], durationMs: 0 });
      }
    },
    [cuaderno, datosDeCelda, registrar],
  );

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

      <PythonStatusBanner status={python} />

      <div className="notebook__cells">
        {cuaderno.cells.map((celda, indice) => (
          <NotebookCellView
            key={celda.id}
            cell={celda}
            index={indice}
            total={cuaderno.cells.length}
            policies={columnas}
            onChange={(source) => cuaderno.setSource(celda.id, source)}
            onRun={() => void ejecutar(celda.id, celda.language, celda.source)}
            onDelete={() => cuaderno.removeCell(celda.id)}
            onDuplicate={() => cuaderno.duplicateCell(celda.id)}
            onMove={(direccion) => cuaderno.moveCell(celda.id, direccion)}
            onLanguage={(language) => cuaderno.setLanguage(celda.id, language)}
          />
        ))}
      </div>

      <NotebookHistoryPanel version={historialVersion} onReuse={reusar} />

      <div className="notebook__add">
        <button type="button" className="button" onClick={() => cuaderno.addCell('python')}>
          <Plus aria-hidden="true" size={14} />
          <FileCode2 aria-hidden="true" size={14} /> Celda de Python
        </button>
        <button type="button" className="button" onClick={() => cuaderno.addCell('javascript')}>
          <Plus aria-hidden="true" size={14} />
          <Code2 aria-hidden="true" size={14} /> Celda de JavaScript
        </button>
      </div>
    </div>
  );
}
