import type { CellOutcome } from './notebook-types';
import type { SimboloNotebook } from './notebook-symbols';
import { columnasParaR } from './r-data';
import { pedirAlSandbox } from './sandbox/cliente';

/**
 * Intérprete de R del cuaderno: R 4.x compilado a WebAssembly (WebR), AISLADO.
 *
 * No corre en la pestaña del portal (MOT-03): WebR arranca dentro del marco de origen opaco
 * (`sandbox/r-anfitrion.ts`) y el código de las celdas corre en SU worker, nacido de un `blob:` de
 * ese marco. Sin cookies, sin DOM del portal y con la CSP del marco, cuya única red son los ficheros
 * estáticos de `/pyodide/` y `/webr/`: una celda de R no puede pedir `/v1/session/refresh`.
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
 *   CSP del marco aislado (`connect-src` sólo `/pyodide/` y `/webr/`) no lo permite. Se trabaja
 *   con la base de R y los recomendados que vienen en el artefacto, que es lo que hace que el
 *   cuaderno sea reproducible: dos personas con el mismo código ven lo mismo.
 * - **Salir a la red.** `download.file`, `url()` y `readLines("https://…")` chocan contra la misma
 *   política, y `webr::eval_js("fetch(…)")` también: corre en un worker de origen opaco, sin
 *   cookies que mandar y sin permiso para hablar con `/v1/*`.
 *
 * ## Por qué el canal es `PostMessage`
 *
 * El canal por omisión de WebR usa `SharedArrayBuffer`, que exige aislar el origen con COOP/COEP —y
 * eso un documento de origen opaco no lo puede tener—. `PostMessage` no lo necesita y, además, no
 * deja al worker pedirle al documento que evalúe JavaScript (`eval-await`). Lo que se pierde es poder INTERRUMPIR una
 * evaluación en marcha y leer de la entrada estándar; ninguna de las dos cosas la usa un cuaderno
 * de análisis, y la primera se sustituye recargando la pestaña.
 */

let promesa: Promise<void> | null = null;

/**
 * Carga el intérprete UNA vez y lo conserva entre celdas.
 *
 * Es lo que hace que una variable definida en la celda 1 exista en la celda 3, que es la mitad de
 * lo que significa «cuaderno». Reentrante: dos celdas lanzadas a la vez comparten la misma carga.
 */
export function loadRRuntime(informar: (detalle: string) => void): Promise<void> {
  if (promesa) return promesa;

  promesa = (async () => {
    informar('Preparando el entorno aislado…');
    const carga = await pedirAlSandbox(
      'r-cargar',
      { orden: { accion: 'cargar' } },
      { progreso: informar },
    );
    if (!carga.ok) throw new Error(carga.error);
  })();

  // Si falla, se olvida la promesa: sin esto, un fallo de red en la primera carga dejaba el
  // cuaderno con R roto para siempre y sólo se arreglaba recargando la página entera.
  promesa.catch(() => {
    promesa = null;
  });

  return promesa;
}

/**
 * Ejecuta una celda con la página cargada (`df`, `columns` y `n` ya preparados) y devuelve su
 * resultado y los nombres VIVOS del intérprete, para la memoria de variables del editor.
 *
 * Las columnas se tipan AQUÍ (`r-data.ts`), del lado del portal: es la parte que decide qué ve el
 * análisis y se comprueba sin cargar el intérprete. Al marco sólo viajan datos.
 */
export async function runRCell(
  codigo: string,
  datos: { rows: Record<string, unknown>[]; columns: string[] },
): Promise<{ outcome: CellOutcome; simbolos: SimboloNotebook[] }> {
  const carga = await pedirAlSandbox('r-ejecutar', {
    orden: {
      accion: 'ejecutar',
      codigo,
      nombres: datos.columns,
      columnas: columnasParaR(datos.rows, datos.columns),
    },
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
      : { ...salida, error: mensajeDeError(salida.error) };
  return { outcome, simbolos: carga.simbolos };
}

/**
 * El mensaje de un error de R, sin el envoltorio del cuaderno.
 *
 * WebR devuelve `Error in eval(expresion, envir = globalenv()) : objeto 'ventas' no encontrado`, y
 * la primera mitad es el intérprete del cuaderno, no el código de quien escribió la celda.
 * Enseñarla manda a buscar el fallo en una función que esa persona no escribió.
 */
export function mensajeDeError(texto: string): string {
  return texto.replace(/^Error in eval\(expresion, envir = globalenv\(\)\)\s*:\s*/u, 'Error: ');
}
