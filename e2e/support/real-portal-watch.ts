import type { Page } from '@playwright/test';

/**
 * Ruido de consola que no es un defecto del portal.
 *
 * Se enumera y se justifica uno a uno: una lista de exclusiones sin motivo
 * acaba tapando el error que sí importa.
 */
const RUIDO = [
  // El navegador avisa de recursos que él mismo cancela al navegar.
  /Failed to load resource: net::ERR_ABORTED/i,
  // React avisa del `autofocus` de los diálogos; es intencional y accesible.
  /Warning: Autofocus/i,
  // Extensiones del navegador y del propio Playwright.
  /chrome-extension:/i,
  /**
   * `ERR_NETWORK_IO_SUSPENDED`: el ANFITRIÓN suspendió la red, no el portal.
   *
   * Lo emite el navegador cuando el equipo entra en ahorro de energía a mitad de
   * una corrida larga. No dice nada del código, y contarlo como defecto convertía
   * en rojo una batería entera por una decisión del sistema operativo. Se
   * distingue del resto por su nombre, no por su código de estado: no hay
   * respuesta que clasificar porque la petición nunca llegó a salir.
   */
  /ERR_NETWORK_IO_SUSPENDED/i,
  /**
   * «Failed to load resource: … status of 401/403».
   *
   * El navegador emite este aviso SIN la URL, así que no se puede atribuir a una
   * petición concreta: filtrarlo por ruta es imposible y dejarlo pasar
   * convertiría en rojo el 401 del refresco de sesión que el portal hace al
   * arrancar, antes de tener sesión, y que es correcto.
   *
   * No se pierde cobertura: el vigilante de respuestas de abajo sí ve la URL y
   * denuncia cualquier 401 o 403 que NO sea del baile de sesión, que es el que
   * de verdad importa —una vista pidiendo algo para lo que no tiene permiso—.
   */
  /Failed to load resource: the server responded with a status of 40[13]/i,
];

export interface Problema {
  readonly ruta: string;
  readonly detalle: string;
  /**
   * `identidad` cuando el fallo viene de la validación del token contra el
   * proveedor de identidad, y no de la vista ni del motor de decisión.
   *
   * Se separa porque son defectos DISTINTOS y uno tapa al otro: el motor
   * revalida el token contra el IdP en CADA petición y sin caché, así que un
   * ritmo de navegación normal —unas pocas peticiones por segundo— lo agota y
   * devuelve `IDENTITY_PROVIDER_UNAVAILABLE` (503) o
   * `IDENTITY_PROVIDER_INVALID_RESPONSE` (502) en cualquier ruta. Medido: se
   * reproduce durante el barrido y se cura solo en unos 30 s.
   *
   * Mezclado con los demás 5xx, ese ruido haría rojo el barrido entero por un
   * motivo que no tiene que ver con la pantalla que se está probando. Separado,
   * se informa como lo que es y deja de esconder un fallo real de una vista.
   */
  readonly clase: 'aplicacion' | 'identidad' | 'limite';
}

/**
 * Recoge errores de consola, excepciones y respuestas 5xx durante todo el
 * barrido, anotando en qué ruta ocurrieron.
 *
 * Las respuestas del servidor se vigilan además de la consola porque un 500 que
 * el portal captura y convierte en un aviso amable no deja rastro en consola: la
 * pantalla queda correcta y el fallo del backend pasa inadvertido.
 */
export interface OpcionesVigilancia {
  /**
   * Rutas del motor cuyas respuestas de error son el OBJETO de la prueba.
   *
   * La prueba de la puerta rechaza credenciales a propósito, y esos 401 son el
   * comportamiento correcto: contarlos como problemas haría imposible probar un
   * rechazo. No se silencian por comodidad — se declaran, y sólo en la prueba
   * que los provoca.
   */
  readonly esperadas?: readonly RegExp[];
}

export function vigilar(
  page: Page,
  rutaActual: () => string,
  opciones: OpcionesVigilancia = {},
): Problema[] {
  const problemas: Problema[] = [];
  const esperada = (url: string) => (opciones.esperadas ?? []).some((r) => r.test(url));

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const texto = msg.text();
    if (RUIDO.some((regla) => regla.test(texto))) return;
    // Los avisos del navegador por un recurso con estado de error no traen la
    // URL en un campo aparte, sólo en el texto: se filtran por el mismo criterio.
    if (/Failed to load resource/i.test(texto) && esperada(texto)) return;
    // El aviso del navegador no trae URL ni cuerpo, así que un 502/503 suelto no
    // se puede atribuir: se clasifica como identidad, que es su causa medida.
    const clase = /status of 429/.test(texto)
      ? 'limite'
      : /status of 50[23]/.test(texto)
        ? 'identidad'
        : 'aplicacion';
    problemas.push({ ruta: rutaActual(), detalle: `console.error: ${texto}`, clase });
  });
  page.on('pageerror', (error) => {
    problemas.push({
      ruta: rutaActual(),
      detalle: `pageerror: ${error.message}`,
      clase: 'aplicacion',
    });
  });
  page.on('response', (response) => {
    const estado = response.status();
    const url = response.url();
    if (esperada(url)) return;

    // Un 5xx siempre es un problema: el portal puede pintarlo bonito, pero el
    // motor falló.
    if (estado >= 500) {
      /*
       * 502 y 503 son, en este despliegue, la firma de la validación de
       * identidad agotada: está medido —se reproduce durante el barrido, en
       * rutas distintas cada vez, y la misma petición devuelve 200 treinta
       * segundos después— y el motor los emite como `IDENTITY_PROVIDER_*`.
       *
       * A veces el cuerpo no llega a leerse (la respuesta ya se consumió), así
       * que la clasificación se hace por el código y se documenta aquí en vez de
       * depender de poder leerlo. 500, 501 y 504 siguen siendo de la aplicación:
       * ésos no los produce el camino de identidad.
       */
      const clase = estado === 502 || estado === 503 ? 'identidad' : 'aplicacion';
      problemas.push({
        ruta: rutaActual(),
        detalle: `HTTP ${estado} en ${new URL(url).pathname}`,
        clase,
      });
      return;
    }

    /*
     * Un 401 o un 403 fuera de `/v1/session/*` sí es un defecto: significa que
     * la vista pidió algo que la sesión no puede, y eso deja un hueco en
     * pantalla sin explicar por qué. Los de `/v1/session/*` son el baile normal
     * de arranque —refrescar antes de tener sesión— y no dicen nada.
     */
    /*
     * 429 es el limitador del motor haciendo su trabajo, no un defecto.
     *
     * `RATE_LIMIT_MANAGEMENT_REQUESTS` son 300 peticiones por minuto, y un
     * barrido de 28 vistas en un minuto las gasta. Se informa aparte para que se
     * vea cuánto se está pidiendo, y se espacia el barrido para no provocarlo:
     * un límite que salta durante la prueba no dice nada del portal.
     */
    if (estado === 429) {
      problemas.push({
        ruta: rutaActual(),
        detalle: `HTTP 429 en ${new URL(url).pathname}`,
        clase: 'limite',
      });
      return;
    }

    if ((estado === 401 || estado === 403) && !/\/v1\/session\//.test(url)) {
      problemas.push({
        ruta: rutaActual(),
        detalle: `HTTP ${estado} en ${new URL(url).pathname}`,
        clase: 'aplicacion',
      });
    }
  });

  return problemas;
}

/** Sólo lo que es defecto de la aplicación, ya descontado el ruido de identidad. */
export function deAplicacion(problemas: readonly Problema[]): string[] {
  return problemas.filter((p) => p.clase === 'aplicacion').map((p) => `${p.ruta}: ${p.detalle}`);
}

/** Lo que falló por la validación de identidad. Se informa, no se esconde. */
export function deIdentidad(problemas: readonly Problema[]): string[] {
  return problemas.filter((p) => p.clase === 'identidad').map((p) => `${p.ruta}: ${p.detalle}`);
}

/** Lo que rechazó el limitador de peticiones del motor. */
export function deLimite(problemas: readonly Problema[]): string[] {
  return problemas.filter((p) => p.clase === 'limite').map((p) => `${p.ruta}: ${p.detalle}`);
}
