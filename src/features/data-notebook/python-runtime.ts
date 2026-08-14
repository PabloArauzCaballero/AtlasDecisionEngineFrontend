import type { CellOutcome, DerivedTable } from './notebook-types';
import { NORMALIZADOR, PREAMBULO_DATOS } from './python-preamble';

/**
 * Intérprete de Python del cuaderno: CPython compilado a WebAssembly (Pyodide), en la pestaña.
 *
 * Se sirve desde `/pyodide/`, del propio origen, no de un CDN. La CSP del portal declara
 * `script-src 'self'` con `strict-dynamic`, así que este script —inyectado por código nuestro que
 * ya lleva nonce— hereda la confianza; un CDN habría exigido abrirle la mano a un tercero para que
 * ejecute código en una pestaña con sesión de gobierno.
 *
 * El intérprete se carga UNA vez y se conserva entre celdas: es lo que hace que una variable
 * definida en la celda 1 exista en la celda 3, que es la mitad de lo que significa «cuaderno».
 */

const RUTA_PYODIDE = '/pyodide/';
const PAQUETES = ['numpy', 'pandas'];

interface PyodideApi {
  runPythonAsync: (source: string) => Promise<unknown>;
  loadPackage: (names: string[]) => Promise<unknown>;
  setStdout: (options: { batched: (texto: string) => void }) => void;
  setStderr: (options: { batched: (texto: string) => void }) => void;
  globals: { set: (nombre: string, valor: unknown) => void };
}

type Cargador = (options: { indexURL: string }) => Promise<PyodideApi>;

declare global {
  interface Window {
    loadPyodide?: Cargador;
  }
}

let promesa: Promise<PyodideApi> | null = null;
let registro: string[] = [];

function cargarScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>('script[data-atlas-pyodide]');
    if (existente) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.atlasPyodide = 'true';
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error(
          'No se encontró el intérprete en /pyodide/. Ejecuta `node scripts/setup-pyodide.mjs` en el portal para traerlo.',
        ),
      );
    document.head.appendChild(script);
  });
}

/** Carga el intérprete y sus paquetes. Reentrante: varias celdas a la vez comparten la descarga. */
export function loadPythonRuntime(informar: (detalle: string) => void): Promise<PyodideApi> {
  if (promesa) return promesa;

  promesa = (async () => {
    informar('Descargando el intérprete de Python…');
    await cargarScript(`${RUTA_PYODIDE}pyodide.js`);

    const cargador = window.loadPyodide;
    if (!cargador) {
      throw new Error('El intérprete se descargó pero no se registró. Vuelve a cargar la página.');
    }

    informar('Arrancando el intérprete…');
    const pyodide = await cargador({ indexURL: RUTA_PYODIDE });

    // Un `print` no es un valor de retorno: se recoge aparte y se enseña como salida, igual que en
    // un cuaderno de verdad, donde lo impreso y lo devuelto ocupan sitios distintos.
    pyodide.setStdout({ batched: (texto) => registro.push(texto) });
    pyodide.setStderr({ batched: (texto) => registro.push(texto) });

    informar('Cargando pandas y numpy…');
    await pyodide.loadPackage(PAQUETES);
    await pyodide.runPythonAsync(NORMALIZADOR);

    return pyodide;
  })();

  // Si falla, se olvida la promesa: sin esto, un fallo de red en la primera carga dejaba el
  // cuaderno con Python roto para siempre y sólo se arreglaba recargando la página entera.
  promesa.catch(() => {
    promesa = null;
  });

  return promesa;
}

/** Inyecta el dataset actual en el espacio de nombres, dejando `rows`, `columns` y `df`. */
export async function bindPythonData(
  pyodide: PyodideApi,
  datos: { rows: Record<string, unknown>[]; columns: string[] },
): Promise<void> {
  pyodide.globals.set('__atlas_rows_json', JSON.stringify(datos.rows));
  pyodide.globals.set('__atlas_columns_json', JSON.stringify(datos.columns));
  await pyodide.runPythonAsync(PREAMBULO_DATOS);
}

export async function runPythonCell(pyodide: PyodideApi, codigo: string): Promise<CellOutcome> {
  const iniciado = performance.now();
  registro = [];

  try {
    const valor = await pyodide.runPythonAsync(codigo);
    const normalizado = await normalizar(pyodide, valor);

    return {
      status: 'ok',
      value: normalizado.value,
      table: normalizado.table,
      logs: [...registro],
      durationMs: Math.round(performance.now() - iniciado),
    };
  } catch (error) {
    return {
      status: 'error',
      // El mensaje de Pyodide ya trae el `Traceback` completo de Python, que es exactamente lo que
      // alguien necesita leer: recortarlo a la última línea escondería en qué línea falló.
      error: error instanceof Error ? error.message : String(error),
      logs: [...registro],
      durationMs: Math.round(performance.now() - iniciado),
    };
  }
}

async function normalizar(
  pyodide: PyodideApi,
  valor: unknown,
): Promise<{ value: unknown; table?: DerivedTable }> {
  if (valor === undefined || valor === null) return { value: undefined };

  pyodide.globals.set('__atlas_valor', valor);
  const crudo = await pyodide.runPythonAsync('__atlas_normaliza(__atlas_valor)');
  const descrito = JSON.parse(String(crudo)) as
    | { kind: 'none' }
    | { kind: 'value'; value: unknown }
    | { kind: 'table'; columns: string[]; rows: Record<string, unknown>[] };

  if (descrito.kind === 'table') {
    return { value: undefined, table: { columns: descrito.columns, rows: descrito.rows } };
  }
  if (descrito.kind === 'value') return { value: descrito.value };
  return { value: undefined };
}
