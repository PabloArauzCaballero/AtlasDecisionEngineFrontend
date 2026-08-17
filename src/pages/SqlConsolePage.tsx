'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Play, Table2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../api/ApiError';
import { PageHeader } from '../components/PageHeader';
import { ConsoleTabBar } from '../features/sql-console/ConsoleTabBar';
import { DatasetExplorer } from '../features/sql-console/DatasetExplorer';
import { QueryHistoryPanel } from '../features/sql-console/QueryHistoryPanel';
import { ResultsPanel } from '../features/sql-console/ResultsPanel';
import { SqlEditor, type EditorWrite } from '../features/sql-console/SqlEditor';
import { TableSchemaPanel } from '../features/sql-console/TableSchemaPanel';
import {
  ejecutarConsulta,
  fetchQueryHistory,
  fetchSqlCatalog,
} from '../features/sql-console/sql-console.api';
import type {
  CatalogTable,
  QueryResult,
  QueryViolation,
} from '../features/sql-console/sql-console.types';
import { useConsoleTabs } from '../features/sql-console/useConsoleTabs';

type SidePanel = 'esquema' | 'historial';

/**
 * La consola de consultas: explorador, pestañas, editor y panel de resultados.
 *
 * Es la estructura de la consola de BigQuery porque esa estructura resuelve un problema
 * concreto: consultar exige tener a la vista, a la vez, qué tablas hay, qué se está
 * escribiendo y qué salió. Repartir esas tres cosas en pantallas distintas obliga a
 * memorizar nombres de columna entre una y otra, y ahí es donde se escriben las consultas
 * equivocadas.
 *
 * Lo que NO se copió de BigQuery, y por qué:
 *
 *  · **No hay vista previa de tabla.** Allí enseña las primeras filas sin coste; aquí cada
 *    fila es una decisión sobre una persona, y un vistazo sin consulta escrita no queda en
 *    la bitácora como una pregunta con intención.
 *  · **No hay «guardar consulta» en el servidor.** Las pestañas viven en el navegador; el
 *    motivo está en `useConsoleTabs.ts`.
 *  · **No hay cancelar.** El motor corta por reloj (12 s) y esa cota es la que protege a
 *    los demás tenants; un botón de cancelar sugeriría que las consultas largas son un
 *    problema del usuario cuando la cota ya las resuelve.
 */
export function SqlConsolePage() {
  const queryClient = useQueryClient();
  const { tabs, active, activeId, setActiveId, updateStatement, open, close } = useConsoleTabs();
  const [side, setSide] = useState<SidePanel>('esquema');
  const [selected, setSelected] = useState<{ dataset: string; table: CatalogTable } | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [violations, setViolations] = useState<QueryViolation[]>([]);
  const [error, setError] = useState<string | null>(null);
  /*
   * Escrituras hacia el editor.
   *
   * El editor no es un componente controlado —ver `SqlEditor.tsx`, donde está el motivo—,
   * así que insertar una columna o reabrir una consulta del historial no puede hacerse
   * cambiando un `value`: se manda como una orden con testigo. El testigo es lo que
   * distingue «insertar la misma columna otra vez» de «no ha pasado nada».
   */
  const [write, setWrite] = useState<EditorWrite | null>(null);
  const writeToken = useRef(0);

  const catalog = useQuery({
    queryKey: ['sql-console', 'catalog'],
    queryFn: ({ signal }) => fetchSqlCatalog(signal),
    // El catálogo sólo cambia cuando se despliega una migración; refrescarlo en cada
    // montaje gastaría una petición por cada vuelta a la pantalla sin cambiar nada.
    staleTime: 15 * 60 * 1000,
  });

  const history = useQuery({
    queryKey: ['sql-console', 'history'],
    queryFn: ({ signal }) => fetchQueryHistory(25, signal),
  });

  const run = useMutation({
    mutationFn: (statement: string) => ejecutarConsulta(statement),
    onMutate: () => {
      setViolations([]);
      setError(null);
    },
    onSuccess: (data) => {
      setResult(data);
      // El historial incluye también los rechazos, así que se refresca pase lo que pase.
      void queryClient.invalidateQueries({ queryKey: ['sql-console', 'history'] });
    },
    onError: (failure) => {
      setResult(null);
      /*
       * Un rechazo de la guardia llega como 422 con su código y su mensaje ya en español, y
       * hay que pintarlo COMO AVISO EN EL EDITOR, no como un toast de error.
       *
       * La `MutationCache` del portal reporta globalmente los errores de mutación, que es lo
       * correcto para una escritura fallida; aquí escribir SQL inválido es parte normal de
       * escribir SQL, y un toast rojo por cada `SELECT` a medias sería ruido constante.
       */
      const apiError = failure instanceof ApiError ? failure : null;
      if (apiError?.status === 422) {
        setViolations([{ code: apiError.code ?? 'SQL_REJECTED', message: apiError.message }]);
        return;
      }
      setError(apiError?.message ?? 'La consulta no se pudo completar.');
      void queryClient.invalidateQueries({ queryKey: ['sql-console', 'history'] });
    },
  });

  const statement = active?.statement ?? '';

  /*
   * `desdeElEditor` llega cuando el disparo viene del propio editor (Ctrl+Enter).
   *
   * Se prefiere al estado porque el estado va un paso por detrás: entre teclear y pulsar el
   * atajo cabe un render, y en la primera carga —la que paga la descarga de Monaco— esa
   * ventana bastaba para que el atajo leyera la consulta vacía y no hiciera nada, en
   * silencio. El botón no necesita el argumento: para pulsarlo hay que mover el ratón, y
   * para entonces el render ya ocurrió.
   */
  const ejecutar = useCallback(
    (desdeElEditor?: string) => {
      const trimmed = (desdeElEditor ?? statement).trim();
      if (trimmed.length === 0 || run.isPending) return;
      run.mutate(trimmed);
    },
    [run, statement],
  );

  /** Sustituye el texto del editor y deja el estado de la pestaña al día. */
  const escribirEnEditor = useCallback(
    (text: string) => {
      if (!active) return;
      writeToken.current += 1;
      setWrite({ text, token: writeToken.current });
      updateStatement(active.id, text);
    },
    [active, updateStatement],
  );

  const insertar = useCallback(
    (fragment: string) => {
      const separator = statement.length === 0 || statement.endsWith('\n') ? '' : ' ';
      escribirEnEditor(`${statement}${separator}${fragment}`);
    },
    [escribirEnEditor, statement],
  );

  const consultarTabla = useCallback(
    (reference: string) => escribirEnEditor(`SELECT *\nFROM ${reference}\nLIMIT 100`),
    [escribirEnEditor],
  );

  const datasets = catalog.data?.datasets ?? [];
  const maxRows = catalog.data?.limits.maxRows ?? 10_000;

  return (
    /*
     * Envoltorio de alto acotado, y no un fragmento.
     *
     * La consola tiene que caber en la pantalla para que su rejilla se desplace
     * por dentro. Calcular su alto a mano no funciona: por encima hay una
     * cabecera cuyo alto depende de si el texto envuelve, y el respiro de
     * `.content` cambia con el ancho. Aquí el navegador mide — la cabecera toma
     * lo que necesita y la consola se queda con el resto.
     */
    <div className="sql-console-page">
      <PageHeader
        eyebrow="Procesamiento · Consultas SQL"
        title="Consola de consultas"
        description="Consulta de sólo lectura sobre los datasets gobernados del motor: decisiones, catálogo, desenlaces, riesgo y auditoría."
        hint="Cada consulta queda registrada. No hay forma de escribir: la consola sólo ejecuta SELECT."
      />

      <div className="sql-console">
        <DatasetExplorer
          datasets={datasets}
          selected={selected ? { dataset: selected.dataset, table: selected.table.name } : null}
          onSelect={(dataset, table) => {
            setSelected({ dataset, table });
            setSide('esquema');
          }}
          onInsert={insertar}
        />

        <section className="sql-workspace" aria-label="Editor de consultas">
          <ConsoleTabBar
            tabs={tabs}
            activeId={activeId}
            onSelect={setActiveId}
            onOpen={open}
            onClose={close}
          />

          <SqlEditor
            tabId={activeId}
            initialValue={statement}
            onChange={(next) => active && updateStatement(active.id, next)}
            onRun={ejecutar}
            datasets={datasets}
            violations={violations}
            write={write}
            disabled={run.isPending}
          />

          <div className="sql-actions">
            <button
              type="button"
              className="sql-actions__run"
              // Sin argumento a propósito: el `onClick` pasaría el evento del ratón como si
              // fuera la consulta.
              onClick={() => ejecutar()}
              disabled={run.isPending || statement.trim().length === 0}
            >
              <Play size={15} aria-hidden />
              {run.isPending ? 'Ejecutando…' : 'Ejecutar'}
            </button>
            <p className="sql-actions__hint">
              Ctrl+Enter · máximo {maxRows.toLocaleString('es')} filas ·{' '}
              {Math.round((catalog.data?.limits.timeoutMs ?? 12_000) / 1000)} s de límite
            </p>
          </div>

          <ResultsPanel
            result={result}
            violations={violations}
            error={error}
            running={run.isPending}
            maxRows={maxRows}
          />
        </section>

        <aside className="sql-side" aria-label="Panel lateral">
          <div className="sql-side__tabs" role="tablist" aria-label="Panel lateral">
            <button
              type="button"
              role="tab"
              aria-selected={side === 'esquema'}
              className={`sql-side__tab${side === 'esquema' ? ' is-active' : ''}`}
              onClick={() => setSide('esquema')}
            >
              <Table2 size={14} aria-hidden /> Esquema
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={side === 'historial'}
              className={`sql-side__tab${side === 'historial' ? ' is-active' : ''}`}
              onClick={() => setSide('historial')}
            >
              <History size={14} aria-hidden /> Historial
            </button>
          </div>

          {side === 'esquema' ? (
            selected ? (
              <TableSchemaPanel
                dataset={selected.dataset}
                table={selected.table}
                onClose={() => setSelected(null)}
                onInsertColumn={insertar}
                onQueryTable={consultarTabla}
              />
            ) : (
              <p className="sql-side__empty">
                Elige una tabla en el explorador para ver qué es una fila y qué columnas tiene.
              </p>
            )
          ) : (
            <QueryHistoryPanel
              entries={history.data?.entries ?? []}
              loading={history.isLoading}
              onReuse={escribirEnEditor}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
