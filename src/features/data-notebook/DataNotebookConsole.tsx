'use client';

import { useQuery } from '@tanstack/react-query';
import { Code2, FileCode2, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DatasetPanel } from './DatasetPanel';
import { NotebookCellView } from './NotebookCellView';
import { PythonStatusBanner } from './PythonStatusBanner';
import { fetchNotebookCatalog, fetchNotebookPage, type NotebookPage } from './notebook.api';
import type { NotebookLanguage, PythonStatus } from './notebook-types';
import { runJavaScriptCell } from './js-runtime';
import { bindPythonData, loadPythonRuntime, runPythonCell } from './python-runtime';
import { useNotebookCells } from './useNotebookCells';

/**
 * El cuaderno de datos.
 *
 * Lo que gobierna el diseño es el reparto: los DATOS los sirve AtlasBackend, ya acotados por
 * inquilino y enmascarados; el CÓDIGO corre en esta pestaña y en ningún otro sitio. Por eso no hay
 * ningún endpoint que reciba Python o JavaScript: abrir un cuaderno de análisis no le añade al
 * backend una superficie de ejecución remota, que es el riesgo que suele traer una herramienta
 * con esta forma.
 */
export function DataNotebookConsole() {
  const [datasetCode, setDatasetCode] = useState<string>('');
  const [page, setPage] = useState(1);
  const [python, setPython] = useState<PythonStatus>({ phase: 'idle' });

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

  const ejecutar = useCallback(
    async (id: string, language: NotebookLanguage, source: string) => {
      cuaderno.startRun(id);
      const entrada = datosDeCelda();

      if (language === 'javascript') {
        cuaderno.finishRun(id, await runJavaScriptCell(source, entrada));
        return;
      }

      try {
        const pyodide = await loadPythonRuntime((detalle) =>
          setPython({ phase: 'loading', detail: detalle }),
        );
        setPython({ phase: 'ready', packages: ['pandas', 'numpy'] });
        await bindPythonData(pyodide, entrada);
        cuaderno.finishRun(id, await runPythonCell(pyodide, source));
      } catch (error) {
        const razon = error instanceof Error ? error.message : 'No se pudo arrancar Python.';
        setPython({ phase: 'unavailable', reason: razon });
        cuaderno.finishRun(id, { status: 'error', error: razon, logs: [], durationMs: 0 });
      }
    },
    [cuaderno, datosDeCelda],
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
