import { z } from 'zod';

/**
 * El protocolo entre el portal y el marco aislado donde corren las celdas (MOT-03).
 *
 * El marco es un `<iframe sandbox="allow-scripts">` SIN `allow-same-origin`: su origen es opaco
 * (`null`), así que no tiene cookies, ni `localStorage`, ni acceso al DOM del portal. Lo ÚNICO que
 * cruza la frontera son mensajes, y todo lo que viene del marco se trata como entrada no confiable
 * —dentro corre código que alguien pegó en una celda—: se exige el origen opaco, la ventana exacta
 * del marco, un esquema cerrado y unos tamaños máximos. Un mensaje que no cumple se descarta.
 */

export const CANAL_SANDBOX = 'atlas-cuaderno';
export const VERSION_PROTOCOLO = 1;
/** Así se serializa un origen opaco en `MessageEvent.origin`. */
export const ORIGEN_OPACO = 'null';

/** Tope del mensaje entero, medido como JSON. Un DataFrame enorme no debe colgar la pestaña. */
export const MAX_CARACTERES_MENSAJE = 32 * 1024 * 1024;
export const MAX_LINEAS_REGISTRO = 2_000;
const MAX_CARACTERES_LINEA = 100_000;
const MAX_CARACTERES_ERROR = 50_000;
const MAX_FIGURAS = 50;
const MAX_CARACTERES_FIGURA = 15 * 1024 * 1024;
const MAX_FILAS = 200_000;
const MAX_COLUMNAS = 2_000;
const MAX_SIMBOLOS = 5_000;

const texto = (max: number) => z.string().max(max);
const registro = z.array(texto(MAX_CARACTERES_LINEA)).max(MAX_LINEAS_REGISTRO + 1);
const id = z.string().min(1).max(64);

const cabecera = { canal: z.literal(CANAL_SANDBOX), v: z.literal(VERSION_PROTOCOLO) };

const mensajeDelSandbox = z.discriminatedUnion('tipo', [
  z.object({ ...cabecera, tipo: z.literal('listo') }),
  z.object({ ...cabecera, tipo: z.literal('progreso'), id, detalle: texto(300) }),
  z.object({ ...cabecera, tipo: z.literal('resultado'), id, carga: z.unknown() }),
]);

export type MensajeDelSandbox = z.infer<typeof mensajeDelSandbox>;

/** Sólo PNG en base64: lo que acaba en un `src` no puede ser otra cosa que una imagen. */
const figura = z
  .string()
  .max(MAX_CARACTERES_FIGURA)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/u);

const tabla = z.object({
  columns: z.array(texto(1_000)).max(MAX_COLUMNAS),
  rows: z.array(z.record(z.unknown())).max(MAX_FILAS),
});

const salidaPython = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    value: z.unknown(),
    table: tabla.optional(),
    images: z.array(figura).max(MAX_FIGURAS).optional(),
    logs: registro,
    durationMs: z.number().nonnegative(),
  }),
  z.object({
    status: z.literal('error'),
    error: texto(MAX_CARACTERES_ERROR),
    logs: registro,
    durationMs: z.number().nonnegative(),
  }),
]);

const simbolo = z.object({
  nombre: texto(200),
  detalle: texto(200),
  origen: z.enum(['variable', 'funcion', 'modulo']),
});

const fallo = z.object({ ok: z.literal(false), error: texto(MAX_CARACTERES_ERROR) });

/** Lo que puede devolver cada operación. Un `carga` que no encaja es una respuesta inválida. */
export const CARGAS = {
  'python-cargar': z.union([
    z.object({ ok: z.literal(true), paquetes: z.array(texto(40)).max(20) }),
    fallo,
  ]),
  'python-ejecutar': z.union([
    z.object({
      ok: z.literal(true),
      salida: salidaPython,
      simbolos: z.array(simbolo).max(MAX_SIMBOLOS),
    }),
    fallo,
  ]),
  javascript: z.union([
    z.object({
      ok: z.literal(true),
      resultado: z.unknown(),
      registro: registro.optional(),
    }),
    z.object({
      ok: z.literal(false),
      error: texto(MAX_CARACTERES_ERROR).optional(),
      plazo: z.literal(true).optional(),
      registro: registro.optional(),
    }),
  ]),
} as const;

export type OperacionSandbox = keyof typeof CARGAS;
export type CargaDe<O extends OperacionSandbox> = z.infer<(typeof CARGAS)[O]>;

/**
 * Tamaño aproximado del mensaje. Si no se puede serializar (ciclos, `BigInt`) se trata como
 * demasiado grande: lo que no se puede medir no se acepta.
 */
export function caracteresDe(valor: unknown): number {
  try {
    return JSON.stringify(valor)?.length ?? 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Valida un mensaje recibido del marco. Devuelve `null` si no es del protocolo o se pasa. */
export function leerMensajeDelSandbox(datos: unknown): MensajeDelSandbox | null {
  const leido = mensajeDelSandbox.safeParse(datos);
  if (!leido.success) return null;
  if (leido.data.tipo === 'resultado' && caracteresDe(datos) > MAX_CARACTERES_MENSAJE) {
    return { ...leido.data, carga: { ok: false, error: RESPUESTA_DEMASIADO_GRANDE } };
  }
  return leido.data;
}

export const RESPUESTA_DEMASIADO_GRANDE =
  'La celda devolvió más datos de los que el cuaderno puede mostrar. Reduce el resultado ' +
  '(por ejemplo con head() o un filtro) y vuelve a ejecutarla.';

export const RESPUESTA_INVALIDA =
  'La celda devolvió una respuesta que el cuaderno no reconoce y se descartó.';

/** Valida la carga de una operación concreta. */
export function leerCarga<O extends OperacionSandbox>(
  operacion: O,
  carga: unknown,
): CargaDe<O> | { ok: false; error: string } {
  const leida = CARGAS[operacion].safeParse(carga);
  return leida.success ? (leida.data as CargaDe<O>) : { ok: false, error: RESPUESTA_INVALIDA };
}
