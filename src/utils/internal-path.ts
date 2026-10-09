/**
 * ¿Este destino es una ruta INTERNA del portal?
 *
 * La pregunta aparece en dos sitios —el `?from=` del login y los enlaces del markdown del
 * cuaderno— y en los dos se contestaba con «empieza por `/` y no por `//`». No basta:
 *
 * - `/\evil.com`: el analizador de URL del navegador trata `\` como `/` en esquemas especiales,
 *   así que se resuelve a `https://evil.com/`. Pasaba el filtro y el login redirigía fuera.
 * - `//evil.com` es una URL relativa al protocolo: otro origen con aspecto de ruta.
 * - Un tabulador o salto de línea en medio (`/\t/evil.com`) lo borra el analizador antes de
 *   resolver, y vuelve a salir `//evil.com`.
 *
 * Por eso no se decide mirando el texto, sino resolviéndolo como lo hará el navegador contra un
 * origen fijo y comprobando que no se sale de él. El origen es ficticio a propósito: la respuesta
 * no puede depender de dónde corre el código (servidor, pruebas, navegador).
 */

const BASE = 'https://portal.invalid';

/** Caracteres de control C0, DEL y C1: el analizador los quita o los trata de forma especial. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

export function isInternalPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//') || value.startsWith('/\\')) return false;
  if (value.includes('\\') || CONTROL_CHARS.test(value)) return false;
  try {
    return new URL(value, BASE).origin === BASE;
  } catch {
    return false;
  }
}

/** El destino si es interno; si no, `fallback`. */
export function safeInternalPath(value: unknown, fallback: string): string {
  return isInternalPath(value) ? value : fallback;
}
