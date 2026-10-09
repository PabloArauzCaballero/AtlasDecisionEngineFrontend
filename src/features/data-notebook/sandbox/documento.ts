import { CANAL_SANDBOX, VERSION_PROTOCOLO } from './protocolo';

/**
 * El documento del marco aislado donde corren las celdas de Python y JavaScript (MOT-03).
 *
 * ## Por qué un marco y no la pestaña
 *
 * Antes, Pyodide corría en la pestaña del portal: con `import js` una celda llegaba a `fetch`,
 * `document` y `location` del portal, así que podía pedir `/v1/session/refresh` (la cookie viajaba)
 * y actuar como la persona, o sacar filas navegando a otro dominio. Las celdas de JavaScript
 * corrían en un worker del MISMO origen, que tampoco ve el DOM pero sí manda la cookie.
 *
 * Ahora el portal monta este documento en un `<iframe sandbox="allow-scripts">` sin
 * `allow-same-origin`. Su origen es opaco: no hay cookies que mandar, ni almacenamiento que leer,
 * ni DOM del portal al que llegar. Y el código de las celdas ni siquiera corre en este documento:
 * corre en WORKERS creados desde aquí, que no pueden navegar (ni el marco ni la pestaña), no tienen
 * `document` y heredan esta CSP, donde la única red permitida son los ficheros de `/pyodide/`.
 *
 * Este script es un mero intermediario: crea los workers con el código que le da el portal y
 * reenvía sus respuestas. Escucha SOLO a la ventana madre y SOLO si el mensaje viene del origen del
 * portal (`location.origin` es el de la URL, que es el del portal, aunque el documento sea opaco).
 */

/** El intermediario, tal cual se incrusta. JavaScript plano: no pasa por el compilador. */
export const SCRIPT_INTERMEDIARIO = `(function () {
  'use strict';
  var CANAL = ${JSON.stringify(CANAL_SANDBOX)};
  var VERSION = ${VERSION_PROTOCOLO};
  var PORTAL = location.origin;
  var BASE_PYODIDE = new URL('/pyodide/', location.href).href;
  var MAX_FUENTE = 4000000;
  var python = null;
  var pendientesPython = new Set();

  function alPortal(mensaje) {
    mensaje.canal = CANAL;
    mensaje.v = VERSION;
    parent.postMessage(mensaje, PORTAL);
  }

  function fallarPython(motivo) {
    pendientesPython.forEach(function (id) {
      alPortal({ tipo: 'resultado', id: id, carga: { ok: false, error: motivo } });
    });
    pendientesPython.clear();
    if (python) python.terminate();
    python = null;
  }

  function arrancarPython(fuente) {
    var url = URL.createObjectURL(new Blob([fuente], { type: 'text/javascript' }));
    python = new Worker(url);
    python.onmessage = function (evento) {
      var datos = evento.data;
      if (!datos || typeof datos.id !== 'string' || !pendientesPython.has(datos.id)) return;
      if (datos.tipo === 'progreso') {
        alPortal({ tipo: 'progreso', id: datos.id, detalle: String(datos.detalle).slice(0, 300) });
      } else if (datos.tipo === 'resultado') {
        pendientesPython.delete(datos.id);
        alPortal({ tipo: 'resultado', id: datos.id, carga: datos.carga });
      }
    };
    python.onerror = function (evento) {
      evento.preventDefault();
      fallarPython(evento.message || 'El intérprete de Python se detuvo.');
    };
  }

  function correrJavaScript(id, fuente, datos, plazoMs) {
    var url = URL.createObjectURL(new Blob([fuente], { type: 'text/javascript' }));
    var worker = null;
    var temporizador = null;
    var hecho = false;
    function cerrar(carga) {
      if (hecho) return;
      hecho = true;
      if (temporizador) clearTimeout(temporizador);
      if (worker) worker.terminate();
      URL.revokeObjectURL(url);
      alPortal({ tipo: 'resultado', id: id, carga: carga });
    }
    try {
      worker = new Worker(url);
    } catch (error) {
      cerrar({ ok: false, error: 'JavaScript no está disponible en este ambiente. Avisa a soporte.' });
      return;
    }
    temporizador = setTimeout(function () {
      cerrar({ ok: false, plazo: true });
    }, Math.min(Math.max(Number(plazoMs) || 0, 1000), 120000));
    worker.onmessage = function (evento) {
      cerrar(evento.data);
    };
    worker.onerror = function (evento) {
      evento.preventDefault();
      cerrar({
        ok: false,
        error: evento.message || 'El código no se pudo cargar: revisa la sintaxis.',
        registro: [],
      });
    };
    worker.postMessage(datos);
  }

  addEventListener('message', function (evento) {
    if (evento.source !== parent || evento.origin !== PORTAL) return;
    var m = evento.data;
    if (!m || m.canal !== CANAL || m.v !== VERSION) return;
    if (typeof m.id !== 'string' || m.id.length > 64) return;
    if (typeof m.fuente !== 'string' || m.fuente.length > MAX_FUENTE) return;
    if (m.op === 'python') {
      if (!python) arrancarPython(m.fuente);
      pendientesPython.add(m.id);
      python.postMessage({ id: m.id, orden: m.orden, base: BASE_PYODIDE });
    } else if (m.op === 'javascript') {
      correrJavaScript(m.id, m.fuente, m.datos, m.plazoMs);
    }
  });

  alPortal({ tipo: 'listo' });
})();`;

export function documentoDelSandbox(nonce: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Cuaderno · entorno aislado</title>
</head>
<body>
<script nonce="${nonce}">${SCRIPT_INTERMEDIARIO}</script>
</body>
</html>`;
}

/** `host[:puerto]` tal cual llega en la cabecera `Host`. Cualquier otra cosa no entra en la CSP. */
const HOST_VALIDO = /^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:.]+\])(?::\d{1,5})?$/iu;

/**
 * La CSP del marco. La del portal no aplica aquí: este documento no la hereda y se le sirve otra.
 *
 * - `sandbox allow-scripts`: aunque alguien abra la URL directamente, sin el marco, el documento
 *   sigue siendo opaco.
 * - `connect-src` sólo `/pyodide/` del propio servidor: el intérprete descarga ahí su núcleo y
 *   sus ruedas, y NADA más. `/v1/*`, `/atlas-backend/*` o un dominio ajeno chocan aquí. La fuente
 *   lleva ruta, y una fuente con ruta exige escribir el host: por eso se compone con la cabecera
 *   `Host` (validada) en vez de con `'self'`. Sin un host válido, no hay red en absoluto.
 * - `script-src`: el intermediario por nonce, `importScripts` de `/pyodide/` y la compilación de
 *   WebAssembly. Nada de `'unsafe-eval'`.
 * - `worker-src blob:`: los workers de las celdas.
 * - `frame-ancestors 'self'`: sólo el portal puede montarlo.
 */
export function politicaDelSandbox(nonce: string, host: string | null): string {
  const pyodide = host && HOST_VALIDO.test(host) ? `${host}/pyodide/` : null;
  return [
    'sandbox allow-scripts',
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${pyodide ?? ''} 'wasm-unsafe-eval'`.replace(/\s+/gu, ' '),
    'worker-src blob:',
    `connect-src ${pyodide ?? "'none'"}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
  ].join('; ');
}
