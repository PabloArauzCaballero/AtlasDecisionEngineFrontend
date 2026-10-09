import { MAX_LINEAS_REGISTRO } from './protocolo';
import {
  CAPTURA_FIGURAS,
  INVENTARIO_SIMBOLOS,
  NORMALIZADOR,
  PREAMBULO_DATOS,
} from '../python-preamble';

/**
 * Lo que el cuaderno querría tener. Se cargan UNO A UNO y el que falte no arrastra a los demás.
 *
 * `loadPackage(['numpy','pandas','matplotlib'])` es una sola operación: si una rueda no está en
 * `public/pyodide/` —un artefacto traído antes de que matplotlib entrara en esta lista— falla la
 * llamada entera y el cuaderno se queda sin pandas, que sí estaba. Cargando por separado, lo que
 * falta se pierde solo y la pantalla puede decir qué se puede importar de verdad.
 */
export const PAQUETES_DESEADOS = ['numpy', 'pandas', 'matplotlib'];

/**
 * El worker de Python, como texto: el marco aislado lo arranca desde un `blob:` (ver `documento.ts`).
 *
 * Corre en un worker y no en el documento del marco por dos motivos: un worker no puede navegar
 * —así que una celda no puede sacar filas con `js.location = 'https://…?d=…'`— y no tiene DOM. Lo
 * que `import js` alcanza aquí es el ámbito del worker: `fetch` choca con la CSP del marco (sólo
 * `/pyodide/`) y, aunque no chocara, sale desde un origen opaco, sin cookies.
 *
 * El intérprete se carga UNA vez y se conserva entre celdas: es lo que hace que una variable
 * definida en la celda 1 exista en la celda 3. Las órdenes se atienden de una en una, en orden.
 */
export function fuenteDelWorkerPython(): string {
  return `'use strict';
const PAQUETES = ${JSON.stringify(PAQUETES_DESEADOS)};
const NORMALIZADOR = ${JSON.stringify(NORMALIZADOR)};
const CAPTURA_FIGURAS = ${JSON.stringify(CAPTURA_FIGURAS)};
const PREAMBULO_DATOS = ${JSON.stringify(PREAMBULO_DATOS)};
const INVENTARIO_SIMBOLOS = ${JSON.stringify(INVENTARIO_SIMBOLOS)};
const MAX_LINEAS = ${MAX_LINEAS_REGISTRO};

let pyodide = null;
let cargando = null;
let paquetes = [];
let registro = [];
let cola = Promise.resolve();

const mensajeDe = (error) => (error instanceof Error ? error.message : String(error));

function anotar(texto) {
  if (registro.length < MAX_LINEAS) registro.push(String(texto).slice(0, 100000));
  else if (registro.length === MAX_LINEAS) registro.push('… salida recortada: demasiadas líneas.');
}

async function arrancar(base, avisar) {
  avisar('Descargando el intérprete de Python…');
  try {
    importScripts(base + 'pyodide.js');
  } catch (error) {
    throw new Error('Python no está disponible en este ambiente. Avisa a soporte.');
  }
  if (typeof self.loadPyodide !== 'function') {
    throw new Error('El intérprete se descargó pero no se registró. Vuelve a cargar la página.');
  }
  avisar('Arrancando el intérprete…');
  const py = await self.loadPyodide({ indexURL: base });
  // Un print no es un valor de retorno: se recoge aparte y se enseña como salida.
  py.setStdout({ batched: anotar });
  py.setStderr({ batched: anotar });
  const conseguidos = [];
  for (const paquete of PAQUETES) {
    avisar('Cargando ' + paquete + '…');
    try {
      await py.loadPackage([paquete]);
      conseguidos.push(paquete);
    } catch (error) {
      // Sin rueda en disco: la pantalla dirá lo que hay de verdad.
    }
  }
  // AGG dibuja en memoria; el backend de serie de Pyodide busca un lienzo que aquí no existe.
  await py.runPythonAsync('import os\\nos.environ.setdefault("MPLBACKEND", "AGG")');
  await py.runPythonAsync(NORMALIZADOR);
  await py.runPythonAsync(CAPTURA_FIGURAS);
  paquetes = conseguidos;
  pyodide = py;
}

async function cargar(base, avisar) {
  if (pyodide) return;
  if (!cargando) cargando = arrancar(base, avisar);
  try {
    await cargando;
  } catch (error) {
    // Olvidar el fallo: sin esto, un corte de red en la primera carga dejaba Python roto para siempre.
    cargando = null;
    throw error;
  }
}

async function normalizar(valor) {
  if (valor === undefined || valor === null) return { value: undefined };
  pyodide.globals.set('__atlas_valor', valor);
  const descrito = JSON.parse(String(await pyodide.runPythonAsync('__atlas_normaliza(__atlas_valor)')));
  if (descrito.kind === 'table') {
    return { value: undefined, table: { columns: descrito.columns, rows: descrito.rows } };
  }
  return { value: descrito.kind === 'value' ? descrito.value : undefined };
}

async function figuras() {
  try {
    return JSON.parse(String(await pyodide.runPythonAsync('__atlas_figuras()')));
  } catch (error) {
    return [];
  }
}

async function inventario() {
  try {
    return JSON.parse(String(await pyodide.runPythonAsync(INVENTARIO_SIMBOLOS)));
  } catch (error) {
    return [];
  }
}

async function ejecutar(orden) {
  pyodide.globals.set('__atlas_rows_json', JSON.stringify(orden.rows));
  pyodide.globals.set('__atlas_columns_json', JSON.stringify(orden.columns));
  await pyodide.runPythonAsync(PREAMBULO_DATOS);

  registro = [];
  const iniciado = performance.now();
  let salida;
  try {
    const valor = await pyodide.runPythonAsync(String(orden.codigo));
    const normalizado = await normalizar(valor);
    const imagenes = await figuras();
    salida = {
      status: 'ok',
      value: normalizado.value,
      table: normalizado.table,
      images: imagenes.length ? imagenes : undefined,
      logs: registro.slice(),
      durationMs: Math.round(performance.now() - iniciado),
    };
  } catch (error) {
    // El mensaje de Pyodide ya trae el Traceback completo, que es lo que hay que leer.
    salida = {
      status: 'error',
      error: mensajeDe(error).slice(0, 50000),
      logs: registro.slice(),
      durationMs: Math.round(performance.now() - iniciado),
    };
  }
  return { ok: true, salida: salida, simbolos: await inventario() };
}

async function atender(datos) {
  const id = datos && datos.id;
  const orden = (datos && datos.orden) || {};
  const avisar = (detalle) => self.postMessage({ id: id, tipo: 'progreso', detalle: detalle });
  let carga;
  try {
    await cargar(datos.base, avisar);
    carga = orden.accion === 'cargar' ? { ok: true, paquetes: paquetes } : await ejecutar(orden);
  } catch (error) {
    carga = { ok: false, error: mensajeDe(error).slice(0, 50000) };
  }
  self.postMessage({ id: id, tipo: 'resultado', carga: carga });
}

self.onmessage = (evento) => {
  // El catch mantiene viva la cola: una orden que revienta no debe dejar sordas a las siguientes.
  cola = cola.then(() => atender(evento.data)).catch(() => undefined);
};
`;
}
