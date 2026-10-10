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
 * El lado del portal de los marcos aislados del cuaderno (MOT-03). Ver `documento.ts` para el porqué.
 *
 * Hay DOS marcos por pestaña, cada uno creado la primera vez que una celda lo necesita y conservado
 * después, porque los intérpretes viven dentro y con ellos las variables de una celda a la siguiente:
 *
 * - `general`, para Python y JavaScript, con una CSP SIN `'unsafe-eval'`.
 * - `r`, para R. WebR necesita `'unsafe-eval'` (los bloques `EM_ASM` de Emscripten) y esa concesión
 *   se queda en SU marco, igual de opaco y sin red hacia la API, en vez de extenderse a Python.
 */

export const RUTA_SANDBOX = '/notebook-sandbox';
export const RUTA_SANDBOX_R = '/notebook-sandbox?interprete=r';
const PLAZO_ARRANQUE_MS = 20_000;

type TipoDeMarco = 'general' | 'r';

const RUTA_DEL_MARCO: Record<TipoDeMarco, string> = { general: RUTA_SANDBOX, r: RUTA_SANDBOX_R };
const TITULO_DEL_MARCO: Record<TipoDeMarco, string> = {
  general: 'Entorno aislado del cuaderno',
  r: 'Entorno aislado del cuaderno (R)',
};

/** Qué intérprete del marco atiende cada operación, y en qué marco vive. */
const OPERACION_DEL_MARCO: Record<
  OperacionSandbox,
  { op: 'python' | 'javascript' | 'r'; marco: TipoDeMarco }
> = {
  'python-cargar': { op: 'python', marco: 'general' },
  'python-ejecutar': { op: 'python', marco: 'general' },
  'r-cargar': { op: 'r', marco: 'r' },
  'r-ejecutar': { op: 'r', marco: 'r' },
  javascript: { op: 'javascript', marco: 'general' },
};

interface Pendiente {
  operacion: OperacionSandbox;
  marco: TipoDeMarco;
  resolver: (carga: unknown) => void;
  progreso?: (detalle: string) => void;
}

interface EstadoDelMarco {
  iframe: HTMLIFrameElement | null;
  listo: Promise<Window> | null;
  avisarListo: (() => void) | null;
}

const marcos: Record<TipoDeMarco, EstadoDelMarco> = {
  general: { iframe: null, listo: null, avisarListo: null },
  r: { iframe: null, listo: null, avisarListo: null },
};
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

/** El marco cuya ventana EXACTA mandó el mensaje, o `null` si no es ninguno de los nuestros. */
function marcoDe(fuente: MessageEventSource | null): TipoDeMarco | null {
  for (const tipo of ['general', 'r'] as const) {
    const iframe = marcos[tipo].iframe;
    if (iframe && fuente === iframe.contentWindow) return tipo;
  }
  return null;
}

function escuchar(evento: MessageEvent) {
  // La ventana EXACTA de un marco nuestro y el origen opaco: cualquier otra cosa se descarta.
  const tipo = marcoDe(evento.source);
  if (!tipo || evento.origin !== ORIGEN_OPACO) return;
  const mensaje = leerMensajeDelSandbox(evento.data);
  if (!mensaje) return;

  if (mensaje.tipo === 'listo') {
    marcos[tipo].avisarListo?.();
    return;
  }
  const pendiente = pendientes.get(mensaje.id);
  // Un marco sólo contesta a lo que se le pidió a ÉL: el de R no puede resolver una celda de Python.
  if (!pendiente || pendiente.marco !== tipo) return;
  if (mensaje.tipo === 'progreso') {
    pendiente.progreso?.(mensaje.detalle);
    return;
  }
  pendientes.delete(mensaje.id);
  pendiente.resolver(leerCarga(pendiente.operacion, mensaje.carga));
}

function cerrarMarco(tipo: TipoDeMarco, motivo: string) {
  const estado = marcos[tipo];
  estado.iframe?.remove();
  estado.iframe = null;
  estado.listo = null;
  estado.avisarListo = null;
  for (const [id, pendiente] of pendientes) {
    if (pendiente.marco !== tipo) continue;
    pendientes.delete(id);
    pendiente.resolver({ ok: false, error: motivo });
  }
}

/** Desmonta los marcos y falla lo que estuviera esperando. El siguiente uso los vuelve a crear. */
export function cerrarSandbox(motivo = 'El entorno aislado del cuaderno se reinició.') {
  cerrarMarco('general', motivo);
  cerrarMarco('r', motivo);
}

function abrirSandbox(tipo: TipoDeMarco): Promise<Window> {
  const estado = marcos[tipo];
  if (estado.listo) return estado.listo;
  if (!escuchando) {
    window.addEventListener('message', escuchar);
    escuchando = true;
  }

  const listo = new Promise<Window>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    // `allow-scripts` y NADA más. Sin `allow-same-origin` el origen es opaco: sin cookies, sin
    // almacenamiento y sin acceso a este documento. Añadir ese token desharía el aislamiento.
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.title = TITULO_DEL_MARCO[tipo];
    iframe.hidden = true;
    iframe.src = RUTA_DEL_MARCO[tipo];

    const plazo = setTimeout(() => {
      reject(new Error('El entorno aislado del cuaderno no arrancó. Vuelve a cargar la página.'));
    }, PLAZO_ARRANQUE_MS);
    estado.avisarListo = () => {
      clearTimeout(plazo);
      if (iframe.contentWindow) resolve(iframe.contentWindow);
    };

    estado.iframe = iframe;
    document.body.appendChild(iframe);
  });
  estado.listo = listo;

  listo.catch(() => {
    if (marcos[tipo].listo === listo)
      cerrarMarco(tipo, 'El entorno aislado del cuaderno no arrancó.');
  });
  return listo;
}

/**
 * Pide una operación al marco que la atiende y devuelve su carga YA VALIDADA.
 *
 * Nunca rechaza por lo que haga la celda: un fallo llega como `{ ok: false, error }`. Sólo rechaza
 * si el marco no arranca, y entonces el mensaje es el que la pantalla enseña.
 */
export async function pedirAlSandbox<O extends OperacionSandbox>(
  operacion: O,
  cuerpo: { fuente?: string; orden?: unknown; datos?: unknown; plazoMs?: number },
  opciones: { progreso?: (detalle: string) => void; plazoMs?: number } = {},
): Promise<CargaDe<O> | { ok: false; error: string }> {
  const { op, marco } = OPERACION_DEL_MARCO[operacion];
  const ventana = await abrirSandbox(marco);
  const id = nuevoId();

  return new Promise((resolve) => {
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    pendientes.set(id, {
      operacion,
      marco,
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
