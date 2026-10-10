import { CANAL_SANDBOX, MAX_LINEAS_REGISTRO, VERSION_PROTOCOLO } from './protocolo';
import {
  ARRANQUE,
  CORRER_CELDA,
  INVENTARIO_SIMBOLOS,
  LEER_ERROR,
  LEER_RESULTADO,
  PREAMBULO_DATOS,
} from '../r-preamble';

/** Tamaño del lienzo de los gráficos, en píxeles. Suficiente para leer los rótulos de los ejes. */
export const LIENZO_R = { width: 1008, height: 648 } as const;

/**
 * El anfitrión de R dentro del marco aislado del cuaderno (MOT-03), como texto.
 *
 * Es el intermediario del marco de R (`/notebook-sandbox?interprete=r`, ver `documento.ts`). Arranca
 * WebR —R 4.x compilado a WebAssembly— DENTRO de un marco de origen opaco, en vez de en la pestaña
 * del portal como hasta ahora. Va en un marco PROPIO, separado del de Python y JavaScript, porque
 * WebR necesita `'unsafe-eval'` y esa concesión se queda aquí.
 *
 * ## Por qué hacía falta
 *
 * WebR corría en un worker del MISMO origen que el portal (`/webr/webr-worker.js`): su `connect-src
 * 'self'` alcanzaba `/v1/*` y sus peticiones llevaban la cookie de sesión, así que una celda de R
 * —`webr::eval_js("fetch('/v1/session/refresh', …)")`— podía actuar como quien la ejecutaba. Aquí
 * el worker nace de un `blob:` creado por un documento opaco: hereda su origen (`null`, sin
 * cookies) y su CSP, cuya única red son los ficheros estáticos de `/pyodide/` y `/webr/`.
 *
 * ## Qué corre dónde
 *
 * - **El código de la celda corre en el worker de WebR**, nunca en este documento: un worker no
 *   puede navegar ni tiene DOM, igual que los de Python y JavaScript.
 * - **Este documento sólo corre la biblioteca de WebR** (`/webr/webr.js`, la del mismo paquete que
 *   los binarios) en su canal `PostMessage`. Ese canal es el que NO deja al worker pedirle a este
 *   documento que evalúe JavaScript (`eval-await` sólo existe en el canal `SharedArrayBuffer`), y
 *   además no necesita COOP/COEP, que un origen opaco no puede tener.
 *
 * ## El worker por `blob:`
 *
 * WebR crea su worker con `new Worker(baseUrl + 'webr-worker.js')`, y un documento opaco no puede
 * arrancar un worker desde una URL de red: para el navegador es de otro origen y lo rechaza. WebR
 * sólo cambia a `blob:` si la URL es de otro HOST, que aquí no lo es. Por eso el anfitrión descarga
 * él mismo el script del worker y le da a WebR un `Worker` que, SÓLO para esa URL exacta, arranca
 * el `blob:`. Cualquier otra URL pasa tal cual (y choca con `worker-src blob:`).
 */
const SCRIPT_R = `
  var BASE_WEBR = new URL('/webr/', location.href).href;
  var URL_WORKER_R = BASE_WEBR + 'webr-worker.js';
  var R_ARRANQUE = ${JSON.stringify(ARRANQUE)};
  var R_CORRER_CELDA = ${JSON.stringify(CORRER_CELDA)};
  var R_INVENTARIO = ${JSON.stringify(INVENTARIO_SIMBOLOS)};
  var R_LEER_ERROR = ${JSON.stringify(LEER_ERROR)};
  var R_LEER_RESULTADO = ${JSON.stringify(LEER_RESULTADO)};
  var R_PREAMBULO_DATOS = ${JSON.stringify(PREAMBULO_DATOS)};
  var R_LIENZO = ${JSON.stringify(LIENZO_R)};
  var R_MAX_LINEAS = ${MAX_LINEAS_REGISTRO};
  var webR = null;
  var cargandoR = null;
  var colaR = Promise.resolve();

  function mensajeDeR(error) {
    return String(error instanceof Error ? error.message : error).slice(0, 50000);
  }

  function prepararWorkerR() {
    return fetch(URL_WORKER_R).then(function (respuesta) {
      if (!respuesta.ok) throw new Error('R no está disponible en este ambiente. Avisa a soporte.');
      return respuesta.text();
    }).then(function (fuente) {
      var urlBlob = URL.createObjectURL(new Blob([fuente], { type: 'text/javascript' }));
      var Nativo = self.Worker;
      self.Worker = class extends Nativo {
        constructor(url, opciones) {
          super(String(url) === URL_WORKER_R ? urlBlob : url, opciones);
        }
      };
    });
  }

  async function arrancarR(avisar) {
    avisar('Descargando el intérprete de R…');
    await prepararWorkerR();
    var modulo = await import(BASE_WEBR + 'webr.js');
    var instancia = new modulo.WebR({
      baseUrl: BASE_WEBR,
      // Sin COOP/COEP (imposibles en un origen opaco) y sin que el worker pueda pedir a este
      // documento que evalúe nada: ver la explicación en r-anfitrion.ts.
      channelType: modulo.ChannelType.PostMessage,
      // Sin consola interactiva: con este canal, una espera de entrada colgaría la celda.
      interactive: false,
    });
    await instancia.init();
    avisar('Preparando el entorno de análisis…');
    await instancia.evalRVoid(R_ARRANQUE);
    webR = instancia;
  }

  async function cargarR(avisar) {
    if (webR) return;
    if (!cargandoR) cargandoR = arrancarR(avisar);
    try {
      await cargandoR;
    } catch (error) {
      // Olvidar el fallo: un corte de red en la primera carga no debe dejar R roto para siempre.
      cargandoR = null;
      throw error;
    }
  }

  function aBase64(imagen) {
    try {
      var lienzo = document.createElement('canvas');
      lienzo.width = imagen.width;
      lienzo.height = imagen.height;
      var contexto = lienzo.getContext('2d');
      if (!contexto) return '';
      contexto.drawImage(imagen, 0, 0);
      return lienzo.toDataURL('image/png').split(',')[1] || '';
    } catch (error) {
      return '';
    } finally {
      // Memoria del navegador que el recolector no libera.
      if (imagen && typeof imagen.close === 'function') imagen.close();
    }
  }

  async function simbolosR() {
    try {
      return JSON.parse(String(await webR.evalRString(R_INVENTARIO)));
    } catch (error) {
      return [];
    }
  }

  async function ejecutarR(orden) {
    await webR.objs.globalEnv.bind('.atlas_nombres', orden.nombres);
    await webR.objs.globalEnv.bind('.atlas_columnas', orden.columnas);
    await webR.evalRVoid(R_PREAMBULO_DATOS);

    var iniciado = performance.now();
    var registro = [];
    var duracion = function () { return Math.round(performance.now() - iniciado); };
    var refugio = await new webR.Shelter();
    var salida;
    try {
      // El código viaja como VARIABLE, nunca interpolado en el envoltorio de R.
      await webR.objs.globalEnv.bind('.atlas_codigo', String(orden.codigo));
      var captura = await refugio.captureR(R_CORRER_CELDA, {
        captureStreams: true,
        captureConditions: false,
        captureGraphics: { width: R_LIENZO.width, height: R_LIENZO.height, bg: 'white', capture: true },
        withAutoprint: false,
      });
      captura.output.forEach(function (linea) {
        if (typeof linea.data !== 'string') return;
        if (registro.length < R_MAX_LINEAS) registro.push(linea.data.slice(0, 100000));
        else if (registro.length === R_MAX_LINEAS) registro.push('… salida recortada: demasiadas líneas.');
      });
      var fallo = String(await webR.evalRString(R_LEER_ERROR)).trim();
      if (fallo) {
        salida = { status: 'error', error: fallo.slice(0, 50000), logs: registro, durationMs: duracion() };
      } else {
        var descrito = JSON.parse(String(await webR.evalRString(R_LEER_RESULTADO)));
        var imagenes = captura.images.map(aBase64).filter(Boolean);
        salida = {
          status: 'ok',
          value: descrito.kind === 'value' ? descrito.value : undefined,
          table: descrito.kind === 'table' ? { columns: descrito.columns, rows: descrito.rows } : undefined,
          images: imagenes.length ? imagenes : undefined,
          logs: registro,
          durationMs: duracion(),
        };
      }
    } catch (error) {
      salida = { status: 'error', error: mensajeDeR(error), logs: registro, durationMs: duracion() };
    } finally {
      // El refugio retiene lo que la celda creó del lado de R: sin vaciarlo, la memoria crece.
      await refugio.purge();
    }
    return { ok: true, salida: salida, simbolos: await simbolosR() };
  }

  async function atenderR(id, orden) {
    var avisar = function (detalle) {
      alPortal({ tipo: 'progreso', id: id, detalle: String(detalle).slice(0, 300) });
    };
    var carga;
    try {
      await cargarR(avisar);
      carga = orden && orden.accion === 'ejecutar' ? await ejecutarR(orden) : { ok: true };
    } catch (error) {
      carga = { ok: false, error: mensajeDeR(error) };
    }
    alPortal({ tipo: 'resultado', id: id, carga: carga });
  }

  function encolarR(id, orden) {
    // De una en una y en orden; el catch mantiene viva la cola si una orden revienta.
    colaR = colaR.then(function () { return atenderR(id, orden); }).catch(function () {});
  }
`;

/**
 * El intermediario completo del marco de R. Escucha SOLO a la ventana madre, SOLO si el mensaje
 * viene del origen del portal, y SOLO órdenes de R: aquí no se arranca código que mande el portal.
 */
export const SCRIPT_INTERMEDIARIO_R = `(function () {
  'use strict';
  var CANAL = ${JSON.stringify(CANAL_SANDBOX)};
  var VERSION = ${VERSION_PROTOCOLO};
  var PORTAL = location.origin;

  function alPortal(mensaje) {
    mensaje.canal = CANAL;
    mensaje.v = VERSION;
    parent.postMessage(mensaje, PORTAL);
  }
${SCRIPT_R}
  addEventListener('message', function (evento) {
    if (evento.source !== parent || evento.origin !== PORTAL) return;
    var m = evento.data;
    if (!m || m.canal !== CANAL || m.v !== VERSION || m.op !== 'r') return;
    if (typeof m.id !== 'string' || m.id.length > 64) return;
    encolarR(m.id, m.orden);
  });

  alPortal({ tipo: 'listo' });
})();`;
