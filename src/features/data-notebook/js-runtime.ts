import type { CellOutcome } from './notebook-types';
import { MAX_LINEAS_REGISTRO } from './sandbox/protocolo';
import { pedirAlSandbox } from './sandbox/cliente';

/**
 * Ejecutor de JavaScript del cuaderno.
 *
 * El código de quien usa el cuaderno NO se evalúa con `eval` ni con `new Function`: se convierte
 * en el CUERPO de un worker que se carga desde un `blob:`. La diferencia no es estilística. Ni la
 * CSP del portal ni la del marco aislado admiten `unsafe-eval`, mientras que `worker-src blob:` sí
 * está declarado en el marco. Cargar un script es una operación que la política permite; generar
 * código en caliente, no.
 *
 * Y el worker NO se crea en la pestaña del portal (MOT-03). Un worker del mismo origen no ve el
 * DOM, pero sí manda la cookie de sesión: pidiendo `/v1/session/refresh` una celda podía
 * renovar la sesión y actuar como la persona. Se crea dentro del marco aislado
 * (`sandbox/documento.ts`), con origen opaco y una CSP sin red: sin cookies que mandar, sin
 * `document`, sin `parent` y sin poder navegar. Si el código no termina, el marco lo mata con
 * `terminate()`: un `while (true)` en una celda cuelga su worker, no la pestaña.
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
const __anotar = (...args) => {
  if (__registro.length < ${MAX_LINEAS_REGISTRO}) __registro.push(args.map(__formatear).join(' ').slice(0, 100000));
};
const console = { log: __anotar, info: __anotar, warn: __anotar, error: __anotar };

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

export async function runJavaScriptCell(
  codigo: string,
  datos: { rows: Record<string, unknown>[]; columns: string[] },
): Promise<CellOutcome> {
  const iniciado = performance.now();
  const duracion = () => Math.round(performance.now() - iniciado);

  let carga;
  try {
    carga = await pedirAlSandbox(
      'javascript',
      {
        fuente: fuenteDelWorker(codigo),
        datos: { rows: datos.rows, columns: datos.columns },
        plazoMs: TIEMPO_MAXIMO_MS,
      },
      // Red de seguridad del portal: el marco ya mata el worker al cumplirse el plazo.
      { plazoMs: TIEMPO_MAXIMO_MS + 5_000 },
    );
  } catch {
    return {
      status: 'error',
      error: 'JavaScript no está disponible en este ambiente. Avisa a soporte.',
      logs: [],
      durationMs: 0,
    };
  }

  if (carga.ok) {
    return {
      status: 'ok',
      value: carga.resultado,
      logs: carga.registro ?? [],
      durationMs: duracion(),
    };
  }
  if ('plazo' in carga && carga.plazo) {
    return {
      status: 'error',
      error: `La celda superó los ${TIEMPO_MAXIMO_MS / 1000} s y se detuvo. Revisa si hay un bucle sin salida.`,
      logs: [],
      durationMs: TIEMPO_MAXIMO_MS,
    };
  }
  return {
    status: 'error',
    error: carga.error ?? 'La celda falló sin mensaje.',
    logs: ('registro' in carga ? carga.registro : undefined) ?? [],
    durationMs: duracion(),
  };
}
