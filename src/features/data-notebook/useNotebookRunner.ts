'use client';

import { useCallback, useState } from 'react';
import { restaurarCeldas } from './notebook-restore';
import { recordNotebookHistory, type NotebookHistoryRow } from './notebook.api';
import { simbolosDisponibles, type SimboloNotebook } from './notebook-symbols';
import { tableFromValue } from './notebook-export';
import type {
  CellOutcome,
  NotebookInterpreter,
  NotebookLanguage,
  RuntimeStatus,
} from './notebook-types';
import { runJavaScriptCell } from './js-runtime';
import {
  bindPythonData,
  capturarSimbolosPython,
  loadPythonRuntime,
  paquetesCargados,
  runPythonCell,
} from './python-runtime';
import { bindRData, capturarSimbolosR, loadRRuntime, runRCell } from './r-runtime';
import type { useNotebookCells } from './useNotebookCells';

/** La misma derivación que hace la vista: un DataFrame ya viene resuelto, un valor de JS no. */
function tablaDe(outcome: CellOutcome) {
  if (outcome.status !== 'ok') return undefined;
  return outcome.table ?? tableFromValue(outcome.value);
}

interface DatosDeCelda {
  rows: Record<string, unknown>[];
  columns: string[];
}

type EstadoMotores = Record<NotebookInterpreter, RuntimeStatus>;
type SimbolosMotores = Record<NotebookInterpreter, readonly SimboloNotebook[]>;

const INTERPRETE_OCIOSO: EstadoMotores = { python: { phase: 'idle' }, r: { phase: 'idle' } };
const SIN_SIMBOLOS: SimbolosMotores = { python: [], r: [] };

/**
 * EJECUTAR una celda: los tres intérpretes, el registro en el historial y los nombres que cada
 * celda conoce.
 *
 * Separado de `DataNotebookConsole` —que se quedó con la composición de la pantalla— al pasar
 * aquélla del límite de 299 líneas del repositorio. La frontera es real: esto es la MÁQUINA del
 * cuaderno y no toca ni un elemento del DOM, así que se puede razonar sobre ella sin montar la
 * vista.
 *
 * ## Por qué el estado de los intérpretes es un mapa y no dos variables
 *
 * Python y R son el mismo problema dos veces: un artefacto grande que se descarga tarde, que puede
 * faltar, y cuyo estado hay que contar en pantalla. Con dos parejas de variables sueltas, cada
 * mejora del aviso —el detalle de la descarga, el motivo del fallo— había que acordarse de hacerla
 * dos veces, y la que se olvidara dejaría a un lenguaje cargando en silencio.
 */
export function useNotebookRunner({
  cuaderno,
  datasetCode,
  page,
  datosDeCelda,
  columnasNombres,
}: {
  cuaderno: ReturnType<typeof useNotebookCells>;
  datasetCode: string;
  page: number;
  datosDeCelda: () => DatosDeCelda;
  columnasNombres: readonly string[];
}) {
  const [motores, setMotores] = useState<EstadoMotores>(INTERPRETE_OCIOSO);
  // Cambia con cada ejecución registrada y hace que el panel de historial vuelva a preguntar.
  const [historialVersion, setHistorialVersion] = useState(0);
  /**
   * Las variables VIVAS de cada intérprete, con su tipo.
   *
   * Sólo Python y R tienen esta lista, y no es un olvido: cada celda de JavaScript corre en su
   * propio worker, así que allí no hay nada que recordar entre celdas. Ver `notebook-symbols.ts`.
   */
  const [simbolos, setSimbolos] = useState<SimbolosMotores>(SIN_SIMBOLOS);

  const anotarMotor = useCallback((motor: NotebookInterpreter, estado: RuntimeStatus) => {
    setMotores((previos) => ({ ...previos, [motor]: estado }));
  }, []);

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
      cuaderno.addCell(lenguajeDeHistorial(fila.language), fila.source);
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

      const motor: NotebookInterpreter = language;
      try {
        const informar = (detalle: string) =>
          anotarMotor(motor, { phase: 'loading', detail: detalle });

        const corrida =
          motor === 'python'
            ? await correrEnPython(informar, entrada, source, anotarMotor)
            : await correrEnR(informar, entrada, source, anotarMotor);

        terminar(corrida.outcome);
        // Los símbolos se leen DESPUÉS de correr, y no antes: es la ejecución la que crea los
        // nombres y fija sus tipos. Se leen también cuando la celda falló, porque una celda que
        // revienta a mitad ya dejó definido lo de las líneas anteriores, y ocultarlo daría una
        // memoria de variables más pobre que la realidad del intérprete.
        setSimbolos((previos) => ({ ...previos, [motor]: corrida.simbolos }));
      } catch (error) {
        const razon = error instanceof Error ? error.message : `No se pudo arrancar ${motor}.`;
        anotarMotor(motor, { phase: 'unavailable', reason: razon });
        terminar({ status: 'error', error: razon, logs: [], durationMs: 0 });
      }
    },
    [anotarMotor, cuaderno, datosDeCelda, registrar],
  );

  /**
   * Qué nombres conoce el editor de la celda `indice`.
   *
   * Se calcula por celda y no una vez para todo el cuaderno porque depende de DÓNDE está: la celda
   * tres ve lo que definieron la uno y la dos, no lo que define la cuatro. Ofrecer un nombre que
   * todavía no existe sería sugerir un error de nombre no encontrado.
   */
  const simbolosHasta = useCallback(
    (indice: number): SimboloNotebook[] => {
      const celda = cuaderno.cells[indice];
      if (!celda || celda.kind !== 'code') return [];
      // El lenguaje se estrecha a los que tienen intérprete VIVO, y así el índice de `simbolos` no
      // necesita una entrada falsa para JavaScript: cada celda suya corre en un worker nuevo, de
      // modo que no hay memoria de variables que consultar, ni vacía.
      const motor: NotebookInterpreter | null =
        celda.language === 'python' || celda.language === 'r' ? celda.language : null;
      return simbolosDisponibles({
        language: celda.language,
        propia: celda.source,
        // JavaScript no hereda nada: cada celda es un worker nuevo (ver `notebook-symbols.ts`).
        previas: motor ? cuaderno.cells.slice(0, indice) : [],
        columnas: columnasNombres,
        runtime: motor ? simbolos[motor] : [],
      });
    },
    [cuaderno.cells, columnasNombres, simbolos],
  );

  return { ejecutar, reusar, simbolosHasta, motores, historialVersion };
}

type Corrida = { outcome: CellOutcome; simbolos: readonly SimboloNotebook[] };
type Anotar = (motor: NotebookInterpreter, estado: RuntimeStatus) => void;

async function correrEnPython(
  informar: (detalle: string) => void,
  entrada: DatosDeCelda,
  source: string,
  anotar: Anotar,
): Promise<Corrida> {
  const pyodide = await loadPythonRuntime(informar);
  // Lo que se cargó DE VERDAD, no una lista escrita a mano. Con la lista fija, un artefacto de
  // Pyodide sin matplotlib seguía anunciando que se podía graficar y el fallo aparecía en el
  // `import` de quien lo intentaba, ya dentro de la celda.
  anotar('python', { phase: 'ready', packages: paquetesCargados() });
  await bindPythonData(pyodide, entrada);
  const outcome = await runPythonCell(pyodide, source);
  return { outcome, simbolos: await capturarSimbolosPython(pyodide) };
}

async function correrEnR(
  informar: (detalle: string) => void,
  entrada: DatosDeCelda,
  source: string,
  anotar: Anotar,
): Promise<Corrida> {
  const webR = await loadRRuntime(informar);
  /*
   * La lista de paquetes va VACÍA, y es lo honesto.
   *
   * R no trae extras opcionales aquí: lo que hay es la base y los recomendados que vienen dentro
   * del artefacto. Anunciar «con dplyr y ggplot2» prometería una instalación que la CSP del
   * cuaderno no permite —van a `repo.r-wasm.org`, un tercero—, y el fallo aparecería dentro de la
   * celda de quien hizo caso.
   */
  anotar('r', { phase: 'ready', packages: [] });
  await bindRData(webR, entrada);
  const outcome = await runRCell(webR, source);
  return { outcome, simbolos: await capturarSimbolosR(webR) };
}

/**
 * Del idioma que guardó el historial al que la celda entiende.
 *
 * El historial es COMPARTIDO con la consola SQL, así que ahí dentro hay entradas `sql` que ninguna
 * celda puede correr. Se recuperan como comentario de JavaScript en vez de descartarse: quien pulsa
 * «reusar» sobre una consulta quiere verla, y hacer desaparecer el botón sin explicación es peor.
 */
function lenguajeDeHistorial(language: string): NotebookLanguage {
  if (language === 'python' || language === 'r') return language;
  return 'javascript';
}

/** Reexportado para que la consola siga restaurando el avance sin conocer el runtime. */
export { restaurarCeldas };
