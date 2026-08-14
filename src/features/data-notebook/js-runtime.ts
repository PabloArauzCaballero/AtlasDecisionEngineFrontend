import type { CellOutcome } from './notebook-types';

/**
 * Ejecutor de JavaScript del cuaderno.
 *
 * El código de quien usa el cuaderno NO se evalúa con `eval` ni con `new Function`: se convierte
 * en el CUERPO de un worker que se carga desde un `blob:`. La diferencia no es estilística. La CSP
 * del portal no admite `unsafe-eval` —y no debe admitirlo, porque abrirlo aquí lo abre para todo
 * el portal—, mientras que `worker-src 'self' blob:` ya está declarado. Cargar un script es una
 * operación que la política permite; generar código en caliente, no.
 *
 * El worker además es un aislamiento real y no una promesa: no comparte el DOM, no ve `document`
 * ni las cookies, y si el código no termina se le mata con `terminate()`. Un `while (true)` en una
 * celda cuelga su worker, no la pestaña.
 */

const TIEMPO_MAXIMO_MS = 30_000;

/** Se inyecta el código tal cual dentro de una función asíncrona, dentro del propio worker. */
function fuenteDelWorker(codigo: string): string {
  return `
const __registro = [];
const __formatear = (valor) => {
  if (typeof valor === 'string') return valor;
  try { return JSON.stringify(valor); } catch { return String(valor); }
};
const console = {
  log: (...args) => __registro.push(args.map(__formatear).join(' ')),
  info: (...args) => __registro.push(args.map(__formatear).join(' ')),
  warn: (...args) => __registro.push(args.map(__formatear).join(' ')),
  error: (...args) => __registro.push(args.map(__formatear).join(' ')),
};

self.onmessage = async (evento) => {
  const { rows, columns } = evento.data;
  // Congelados: una celda no debe poder alterar los datos que la siguiente va a leer, porque
  // entonces el resultado dependería del orden en que se pulsaron los botones.
  Object.freeze(rows);
  rows.forEach((fila) => Object.freeze(fila));

  try {
    const resultado = await (async function () {
${codigo}
    })();
    self.postMessage({ ok: true, resultado, registro: __registro });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? \`\${error.name}: \${error.message}\` : String(error),
      registro: __registro,
    });
  }
};
`;
}

export function runJavaScriptCell(
  codigo: string,
  datos: { rows: Record<string, unknown>[]; columns: string[] },
): Promise<CellOutcome> {
  return new Promise((resolve) => {
    let url: string | null = null;
    let worker: Worker | null = null;
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    const limpiar = () => {
      if (temporizador) clearTimeout(temporizador);
      worker?.terminate();
      if (url) URL.revokeObjectURL(url);
    };

    const iniciado = performance.now();

    try {
      url = URL.createObjectURL(new Blob([fuenteDelWorker(codigo)], { type: 'text/javascript' }));
      worker = new Worker(url);
    } catch (error) {
      limpiar();
      resolve({
        status: 'error',
        error:
          error instanceof Error
            ? `No se pudo arrancar el ejecutor de JavaScript: ${error.message}`
            : 'No se pudo arrancar el ejecutor de JavaScript.',
        logs: [],
        durationMs: 0,
      });
      return;
    }

    temporizador = setTimeout(() => {
      limpiar();
      resolve({
        status: 'error',
        error: `La celda superó los ${TIEMPO_MAXIMO_MS / 1000} s y se detuvo. Revisa si hay un bucle sin salida.`,
        logs: [],
        durationMs: TIEMPO_MAXIMO_MS,
      });
    }, TIEMPO_MAXIMO_MS);

    worker.onmessage = (evento: MessageEvent) => {
      const carga = evento.data as {
        ok: boolean;
        resultado?: unknown;
        error?: string;
        registro?: string[];
      };
      limpiar();
      resolve(
        carga.ok
          ? {
              status: 'ok',
              value: carga.resultado,
              logs: carga.registro ?? [],
              durationMs: Math.round(performance.now() - iniciado),
            }
          : {
              status: 'error',
              error: carga.error ?? 'La celda falló sin mensaje.',
              logs: carga.registro ?? [],
              durationMs: Math.round(performance.now() - iniciado),
            },
      );
    };

    // Un error de SINTAXIS no llega por `onmessage`: el worker ni siquiera se carga, y sin esta
    // rama la celda se quedaba girando hasta agotar el plazo sin decir qué estaba mal.
    worker.onerror = (evento: ErrorEvent) => {
      limpiar();
      resolve({
        status: 'error',
        error: evento.message || 'El código no se pudo cargar: revisa la sintaxis.',
        logs: [],
        durationMs: Math.round(performance.now() - iniciado),
      });
    };

    worker.postMessage({ rows: datos.rows, columns: datos.columns });
  });
}
