import {
  CANAL_SANDBOX,
  ORIGEN_OPACO,
  VERSION_PROTOCOLO,
  leerCarga,
  leerMensajeDelSandbox,
  type CargaDe,
  type OperacionSandbox,
} from './protocolo';

/**
 * El lado del portal del marco aislado del cuaderno (MOT-03). Ver `documento.ts` para el porqué.
 *
 * Hay UN marco por pestaña, creado la primera vez que una celda lo necesita y conservado después:
 * el intérprete de Python vive dentro, y con él las variables de una celda a la siguiente.
 */

export const RUTA_SANDBOX = '/notebook-sandbox';
const PLAZO_ARRANQUE_MS = 20_000;

interface Pendiente {
  operacion: OperacionSandbox;
  resolver: (carga: unknown) => void;
  progreso?: (detalle: string) => void;
}

let marco: HTMLIFrameElement | null = null;
let listo: Promise<Window> | null = null;
let avisarListo: (() => void) | null = null;
let escuchando = false;
let contador = 0;
const pendientes = new Map<string, Pendiente>();

/**
 * Identificador de petición. No es un secreto, sólo un número de orden: `crypto.randomUUID` no
 * existe fuera de un contexto seguro y TEST se sirve también por `http://` y una IP.
 */
function nuevoId(): string {
  contador += 1;
  return `c${contador}-${Math.random().toString(36).slice(2, 10)}`;
}

function escuchar(evento: MessageEvent) {
  // La ventana EXACTA del marco y el origen opaco: cualquier otra cosa no es nuestro marco.
  if (!marco || evento.source !== marco.contentWindow || evento.origin !== ORIGEN_OPACO) return;
  const mensaje = leerMensajeDelSandbox(evento.data);
  if (!mensaje) return;

  if (mensaje.tipo === 'listo') {
    avisarListo?.();
    return;
  }
  const pendiente = pendientes.get(mensaje.id);
  if (!pendiente) return;
  if (mensaje.tipo === 'progreso') {
    pendiente.progreso?.(mensaje.detalle);
    return;
  }
  pendientes.delete(mensaje.id);
  pendiente.resolver(leerCarga(pendiente.operacion, mensaje.carga));
}

/** Desmonta el marco y falla lo que estuviera esperando. El siguiente uso lo vuelve a crear. */
export function cerrarSandbox(motivo = 'El entorno aislado del cuaderno se reinició.') {
  marco?.remove();
  marco = null;
  listo = null;
  avisarListo = null;
  for (const [id, pendiente] of pendientes) {
    pendientes.delete(id);
    pendiente.resolver({ ok: false, error: motivo });
  }
}

function abrirSandbox(): Promise<Window> {
  if (listo) return listo;
  if (!escuchando) {
    window.addEventListener('message', escuchar);
    escuchando = true;
  }

  listo = new Promise<Window>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    // `allow-scripts` y NADA más. Sin `allow-same-origin` el origen es opaco: sin cookies, sin
    // almacenamiento y sin acceso a este documento. Añadir ese token desharía el aislamiento.
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.title = 'Entorno aislado del cuaderno';
    iframe.hidden = true;
    iframe.src = RUTA_SANDBOX;

    const plazo = setTimeout(() => {
      reject(new Error('El entorno aislado del cuaderno no arrancó. Vuelve a cargar la página.'));
    }, PLAZO_ARRANQUE_MS);
    avisarListo = () => {
      clearTimeout(plazo);
      if (iframe.contentWindow) resolve(iframe.contentWindow);
    };

    marco = iframe;
    document.body.appendChild(iframe);
  });

  listo.catch(() => cerrarSandbox());
  return listo;
}

/**
 * Pide una operación al marco y devuelve su carga YA VALIDADA.
 *
 * Nunca rechaza por lo que haga la celda: un fallo llega como `{ ok: false, error }`. Sólo rechaza
 * si el marco no arranca, y entonces el mensaje es el que la pantalla enseña.
 */
export async function pedirAlSandbox<O extends OperacionSandbox>(
  operacion: O,
  cuerpo: { fuente: string; orden?: unknown; datos?: unknown; plazoMs?: number },
  opciones: { progreso?: (detalle: string) => void; plazoMs?: number } = {},
): Promise<CargaDe<O> | { ok: false; error: string }> {
  const ventana = await abrirSandbox();
  const id = nuevoId();
  const op = operacion === 'javascript' ? 'javascript' : 'python';

  return new Promise((resolve) => {
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    pendientes.set(id, {
      operacion,
      progreso: opciones.progreso,
      resolver: (carga) => {
        if (temporizador) clearTimeout(temporizador);
        resolve(carga as CargaDe<O> | { ok: false; error: string });
      },
    });
    // Red de seguridad por si el marco muere sin contestar (el propio marco ya tiene su plazo).
    if (opciones.plazoMs) {
      temporizador = setTimeout(() => {
        if (!pendientes.delete(id)) return;
        resolve({ ok: false, error: 'La celda no respondió a tiempo y se descartó.' });
      }, opciones.plazoMs);
    }
    /*
     * `'*'` como destino es obligado y no es un descuido: un origen opaco no se puede nombrar en
     * `postMessage`. Lo que acota el destinatario es la ventana: es la del marco que creamos, cuyo
     * documento no puede navegar a otro sitio porque el código de las celdas corre en workers.
     */
    ventana.postMessage({ canal: CANAL_SANDBOX, v: VERSION_PROTOCOLO, id, op, ...cuerpo }, '*');
  });
}
