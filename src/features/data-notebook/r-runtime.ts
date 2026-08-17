import { ChannelType, WebR } from 'webr';
import type { CellOutcome, DerivedTable } from './notebook-types';
import {
  ARRANQUE,
  CORRER_CELDA,
  INVENTARIO_SIMBOLOS,
  LEER_RESULTADO,
  PREAMBULO_DATOS,
} from './r-preamble';
import { columnasParaR, type ColumnasR } from './r-data';

/**
 * Intérprete de R del cuaderno: R 4.x compilado a WebAssembly (WebR), en la pestaña.
 *
 * Es la misma decisión que ya gobierna Python, y la que hace que «añadir R» no añada superficie de
 * ataque: **no existe ningún endpoint que reciba R**. El código corre en el navegador de quien lo
 * escribe, sobre la página de datos que el servidor ya sirvió acotada por inquilino y enmascarada.
 * Un RStudio de servidor habría sido lo contrario — una consola con sistema de archivos, red y
 * paquetes, dentro de la red donde viven las bases—, y por eso no es lo que se montó aquí.
 *
 * ## Lo que este intérprete NO puede hacer
 *
 * - **Escribir en ninguna base.** No tiene conexión: sus datos son un `data.frame` en memoria.
 * - **Instalar paquetes.** `install.packages()` y `webr::install()` van a `repo.r-wasm.org`, y la
 *   CSP del artefacto (`connect-src 'self'`, ver `middleware.next.ts`) no lo permite. Se trabaja
 *   con la base de R y los recomendados que vienen en el artefacto, que es lo que hace que el
 *   cuaderno sea reproducible: dos personas con el mismo código ven lo mismo.
 * - **Salir a la red.** `download.file`, `url()` y `readLines("https://…")` chocan contra la misma
 *   política, así que no hay camino por el que una celda saque filas de clientes fuera del portal.
 *
 * ## Por qué el canal es `PostMessage`
 *
 * El canal por omisión de WebR usa `SharedArrayBuffer`, que exige aislar el origen con COOP/COEP —y
 * eso rompería el resto del portal (imágenes, medios y el propio Monaco dejarían de cargar tal como
 * están servidos hoy). `PostMessage` no lo necesita. Lo que se pierde es poder INTERRUMPIR una
 * evaluación en marcha y leer de la entrada estándar; ninguna de las dos cosas la usa un cuaderno
 * de análisis, y la primera se sustituye recargando la pestaña.
 */

const RUTA_WEBR = '/webr/';

/** Tamaño del lienzo de los gráficos, en píxeles. Suficiente para leer los rótulos de los ejes. */
const LIENZO = { width: 1008, height: 648 } as const;

let promesa: Promise<WebR> | null = null;

/**
 * Carga el intérprete UNA vez y lo conserva entre celdas.
 *
 * Es lo que hace que una variable definida en la celda 1 exista en la celda 3, que es la mitad de
 * lo que significa «cuaderno». Reentrante: dos celdas lanzadas a la vez comparten la misma carga.
 */
export function loadRRuntime(informar: (detalle: string) => void): Promise<WebR> {
  if (promesa) return promesa;

  promesa = (async () => {
    informar('Descargando el intérprete de R…');
    const webR = new WebR({
      baseUrl: RUTA_WEBR,
      channelType: ChannelType.PostMessage,
      // Sin consola interactiva: nadie va a teclear en un `readline()`, y con el canal
      // `PostMessage` una espera de entrada dejaría la celda colgada sin forma de responderle.
      interactive: false,
    });

    await webR.init();
    informar('Preparando el entorno de análisis…');
    await webR.evalRVoid(ARRANQUE);
    return webR;
  })();

  // Si falla, se olvida la promesa: sin esto, un fallo de red en la primera carga dejaba el
  // cuaderno con R roto para siempre y sólo se arreglaba recargando la página entera.
  promesa.catch(() => {
    promesa = null;
  });

  return promesa;
}

/** Inyecta la página cargada en el espacio de nombres, dejando `df`, `columns` y `n`. */
export async function bindRData(
  webR: WebR,
  datos: { rows: Record<string, unknown>[]; columns: string[] },
): Promise<void> {
  const columnas: ColumnasR = columnasParaR(datos.rows, datos.columns);
  await webR.objs.globalEnv.bind('.atlas_nombres', datos.columns);
  await webR.objs.globalEnv.bind('.atlas_columnas', columnas);
  await webR.evalRVoid(PREAMBULO_DATOS);
}

/** Lo que una celda de R produjo: salida, valor y gráficos. */
export async function runRCell(webR: WebR, codigo: string): Promise<CellOutcome> {
  const iniciado = performance.now();
  const registro: string[] = [];
  const refugio = await new webR.Shelter();

  try {
    /*
     * El código viaja como VARIABLE, no interpolado en una plantilla de R.
     *
     * Es la misma regla que gobierna el SQL de este cuaderno: lo que escribe una persona es un
     * DATO, nunca parte de la sentencia. Interpolándolo, una llave o una comilla de más en la
     * celda cambiarían el envoltorio en vez de fallar dentro de ella.
     */
    await webR.objs.globalEnv.bind('.atlas_codigo', codigo);

    const captura = await refugio.captureR(CORRER_CELDA, {
      captureStreams: true,
      captureConditions: false,
      // Fondo blanco explícito: R dibuja sobre transparente y el PNG resultante sería ilegible
      // sobre el tema oscuro del portal.
      captureGraphics: { ...LIENZO, bg: 'white', capture: true },
      withAutoprint: false,
    });

    for (const linea of captura.output) {
      if (typeof linea.data === 'string') registro.push(linea.data);
    }

    const normalizado = await leerResultado(webR);
    const imagenes = await Promise.all(captura.images.map(aPngIncrustado));

    return {
      status: 'ok',
      value: normalizado.value,
      table: normalizado.table,
      images: imagenes.length ? imagenes : undefined,
      logs: registro,
      durationMs: Math.round(performance.now() - iniciado),
    };
  } catch (error) {
    return {
      status: 'error',
      error: mensajeDeError(error),
      logs: registro,
      durationMs: Math.round(performance.now() - iniciado),
    };
  } finally {
    // El refugio retiene TODO lo que la celda creó del lado de R. Sin vaciarlo, la memoria del
    // intérprete crece con cada ejecución hasta que la pestaña se arrastra.
    await refugio.purge();
  }
}

/**
 * Los nombres VIVOS del intérprete, con su tipo, para la memoria de variables del editor.
 *
 * Un fallo aquí NO tumba nada: el editor se queda con lo que dedujo leyendo el código. Perder el
 * resultado de una celda por no poder listar sus variables sería un intercambio absurdo.
 */
export async function capturarSimbolosR(
  webR: WebR,
): Promise<{ nombre: string; detalle: string; origen: 'variable' | 'funcion' | 'modulo' }[]> {
  try {
    const crudo = await webR.evalRString(INVENTARIO_SIMBOLOS);
    return JSON.parse(crudo) as {
      nombre: string;
      detalle: string;
      origen: 'variable' | 'funcion' | 'modulo';
    }[];
  } catch {
    return [];
  }
}

async function leerResultado(webR: WebR): Promise<{ value: unknown; table?: DerivedTable }> {
  const crudo = await webR.evalRString(LEER_RESULTADO);
  const descrito = JSON.parse(crudo) as
    | { kind: 'none' }
    | { kind: 'value'; value: unknown }
    | { kind: 'table'; columns: string[]; rows: Record<string, unknown>[] };

  if (descrito.kind === 'table') {
    return { value: undefined, table: { columns: descrito.columns, rows: descrito.rows } };
  }
  if (descrito.kind === 'value') return { value: descrito.value };
  return { value: undefined };
}

/**
 * Un gráfico de R, ya como `data:` listo para pintar y descargar.
 *
 * WebR entrega la figura como `ImageBitmap` —un mapa de bits vivo del worker—, y eso no se puede
 * ni guardar en un cuaderno ni descargar. Se vuelca sobre un lienzo para obtener el PNG, que es la
 * misma forma en la que viajan los gráficos de matplotlib: así el resto del cuaderno —el visor, la
 * descarga, el documento guardado— no tiene que saber de qué intérprete salió la imagen.
 */
async function aPngIncrustado(imagen: ImageBitmap): Promise<string> {
  const lienzo = document.createElement('canvas');
  lienzo.width = imagen.width;
  lienzo.height = imagen.height;
  const contexto = lienzo.getContext('2d');
  if (!contexto) return '';
  contexto.drawImage(imagen, 0, 0);
  // Se cierra el mapa de bits: es memoria del navegador que no libera el recolector.
  imagen.close();
  return lienzo.toDataURL('image/png');
}

/**
 * El mensaje de un error de R, sin el envoltorio del cuaderno.
 *
 * WebR devuelve `Error in eval(expresion, envir = globalenv()) : objeto 'ventas' no encontrado`, y
 * la primera mitad es el intérprete de este archivo, no el código de quien escribió la celda.
 * Enseñarla manda a buscar el fallo en una función que esa persona no escribió.
 */
function mensajeDeError(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);
  return texto.replace(/^Error in eval\(expresion, envir = globalenv\(\)\)\s*:\s*/u, 'Error: ');
}
