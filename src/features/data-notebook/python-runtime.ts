import type { CellOutcome } from './notebook-types';
import type { SimboloNotebook } from './notebook-symbols';
import { pedirAlSandbox } from './sandbox/cliente';
import { fuenteDelWorkerPython } from './sandbox/python-worker';

/**
 * Intérprete de Python del cuaderno: CPython compilado a WebAssembly (Pyodide), AISLADO.
 *
 * No corre en la pestaña del portal (MOT-03): corre en un worker dentro de un marco con origen
 * opaco (`sandbox/documento.ts`). Desde una celda, `import js` llega al ámbito de ese worker —sin
 * DOM, sin cookies, sin poder navegar— y la CSP del marco sólo deja pedir los ficheros de
 * `/pyodide/`. Los datos que la celda necesita los manda el portal por mensaje; la celda no hace
 * peticiones al backend.
 *
 * Los ficheros se sirven desde `/pyodide/`, del propio origen, no de un CDN, y con su SHA-256
 * comprobado al construir (`scripts/setup-pyodide.mjs`).
 *
 * El intérprete se carga UNA vez y se conserva entre celdas: es lo que hace que una variable
 * definida en la celda 1 exista en la celda 3, que es la mitad de lo que significa «cuaderno».
 */

let fuente: string | null = null;
const fuenteWorker = () => (fuente ??= fuenteDelWorkerPython());

let promesa: Promise<void> | null = null;
/** Los que se llegaron a cargar. La pantalla los enseña para no prometer un `import` imposible. */
let cargados: string[] = [];

export function paquetesCargados(): string[] {
  return cargados;
}

/** Carga el intérprete y sus paquetes. Reentrante: varias celdas a la vez comparten la descarga. */
export function loadPythonRuntime(informar: (detalle: string) => void): Promise<void> {
  if (promesa) return promesa;

  promesa = (async () => {
    informar('Preparando el entorno aislado…');
    const carga = await pedirAlSandbox(
      'python-cargar',
      { fuente: fuenteWorker(), orden: { accion: 'cargar' } },
      { progreso: informar },
    );
    if (!carga.ok) throw new Error(carga.error);
    cargados = carga.paquetes;
  })();

  // Si falla, se olvida la promesa: sin esto, un fallo de red en la primera carga dejaba el
  // cuaderno con Python roto para siempre y sólo se arreglaba recargando la página entera.
  promesa.catch(() => {
    promesa = null;
  });

  return promesa;
}

/**
 * Ejecuta una celda con el dataset actual (`rows`, `columns` y `df` ya preparados) y devuelve su
 * resultado y los nombres VIVOS del intérprete, con su tipo, para la memoria de variables.
 *
 * Si el propio preámbulo falla —no la celda, sino la preparación de los datos— se lanza, igual que
 * antes: eso es que Python no está en condiciones, y la pantalla lo dice como tal.
 */
export async function runPythonCell(
  codigo: string,
  datos: { rows: Record<string, unknown>[]; columns: string[] },
): Promise<{ outcome: CellOutcome; simbolos: SimboloNotebook[] }> {
  const carga = await pedirAlSandbox('python-ejecutar', {
    fuente: fuenteWorker(),
    orden: { accion: 'ejecutar', codigo, rows: datos.rows, columns: datos.columns },
  });
  if (!carga.ok) throw new Error(carga.error);

  const { salida } = carga;
  const outcome: CellOutcome =
    salida.status === 'ok'
      ? {
          status: 'ok',
          value: salida.value,
          table: salida.table,
          // El marco devuelve base64 validado; el `data:` se pone aquí, del lado del portal.
          images: salida.images?.map((dato) => `data:image/png;base64,${dato}`),
          logs: salida.logs,
          durationMs: salida.durationMs,
        }
      : salida;
  return { outcome, simbolos: carga.simbolos };
}
