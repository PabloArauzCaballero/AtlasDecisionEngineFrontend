import type { CellOutcome, DerivedTable } from './notebook-types';
import {
  CAPTURA_FIGURAS,
  INVENTARIO_SIMBOLOS,
  NORMALIZADOR,
  PREAMBULO_DATOS,
} from './python-preamble';

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

/**
 * Lo que el cuaderno querría tener. Se cargan UNO A UNO y el que falte no arrastra a los demás.
 *
 * `loadPackage(['numpy','pandas','matplotlib'])` es una sola operación: si una rueda no está en
 * `public/pyodide/` —un artefacto traído antes de que matplotlib entrara en esta lista— falla la
 * llamada entera y el cuaderno se queda sin pandas, que sí estaba. Cargando por separado, lo que
 * falta se pierde solo y la pantalla puede decir qué se puede importar de verdad.
 */
const PAQUETES_DESEADOS = ['numpy', 'pandas', 'matplotlib'];

async function cargarPaquetes(pyodide: PyodideApi, informar: (detalle: string) => void) {
  const conseguidos: string[] = [];
  for (const paquete of PAQUETES_DESEADOS) {
    informar(`Cargando ${paquete}…`);
    try {
      await pyodide.loadPackage([paquete]);
      conseguidos.push(paquete);
    } catch {
      // Sin rueda en disco. No se interrumpe: `paquetesCargados()` dirá lo que hay.
    }
  }
  return conseguidos;
}

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
/** Los que se llegaron a cargar. La pantalla los enseña para no prometer un `import` imposible. */
let cargados: string[] = [];

export function paquetesCargados(): string[] {
  return cargados;
}

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

    const paquetes = await cargarPaquetes(pyodide, informar);

    /*
     * El backend de matplotlib se fija ANTES de que nadie lo importe.
     *
     * Por omisión, matplotlib en Pyodide dibuja sobre un lienzo del navegador que aquí no existe
     * —el cuaderno enseña imágenes, no monta un canvas por celda—, y `savefig` sobre ese backend
     * no produce nada. `AGG` dibuja en memoria, que es exactamente lo que se necesita para
     * devolver un PNG. Se pone en el entorno porque matplotlib lo lee al importarse, y el import
     * ocurre en la celda de quien escribe, no aquí.
     */
    await pyodide.runPythonAsync('import os\nos.environ.setdefault("MPLBACKEND", "AGG")');
    await pyodide.runPythonAsync(NORMALIZADOR);
    await pyodide.runPythonAsync(CAPTURA_FIGURAS);

    cargados = paquetes;
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
    const imagenes = await recogerFiguras(pyodide);

    return {
      status: 'ok',
      value: normalizado.value,
      table: normalizado.table,
      images: imagenes.length ? imagenes : undefined,
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

/**
 * Los nombres VIVOS del intérprete, con su tipo, para la memoria de variables del editor.
 *
 * Se pregunta al espacio de nombres real en vez de deducirlo del código porque el tipo sólo existe
 * después de ejecutar: leyendo `ventas = cargar()` nadie sabe si eso es un DataFrame o un entero, y
 * es justo lo que hace útil la sugerencia.
 *
 * Se filtra lo que Python define solo —dunders, el preámbulo del cuaderno, los módulos que arrastra
 * Pyodide— porque ofrecerlo enterraría los tres nombres que la persona escribió bajo doscientos que
 * no le interesan.
 *
 * Un fallo aquí NO tumba nada: el editor se queda con lo que dedujo leyendo el código, que es lo
 * que tenía antes de ejecutar. Perder el resultado de una celda por no poder listar sus variables
 * sería un intercambio absurdo.
 */
export async function capturarSimbolosPython(
  pyodide: PyodideApi,
): Promise<{ nombre: string; detalle: string; origen: 'variable' | 'funcion' | 'modulo' }[]> {
  try {
    const crudo = await pyodide.runPythonAsync(INVENTARIO_SIMBOLOS);
    const leidos = JSON.parse(String(crudo)) as {
      nombre: string;
      detalle: string;
      origen: 'variable' | 'funcion' | 'modulo';
    }[];
    return leidos;
  } catch {
    return [];
  }
}

/**
 * Las figuras que dejó la celda, ya como `data:` listo para pintar y descargar.
 *
 * Un fallo aquí NO tumba el resultado: si la recogida se rompe, la celda ya calculó su tabla y su
 * valor, y perderlos por no haber podido dibujar sería cambiar un problema pequeño por uno grande.
 * Se devuelve sin imágenes y el resto se enseña igual.
 */
async function recogerFiguras(pyodide: PyodideApi): Promise<string[]> {
  try {
    const crudo = await pyodide.runPythonAsync('__atlas_figuras()');
    const base64 = JSON.parse(String(crudo)) as string[];
    return base64.map((dato) => `data:image/png;base64,${dato}`);
  } catch {
    return [];
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
