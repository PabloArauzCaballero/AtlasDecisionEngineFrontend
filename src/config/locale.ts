/**
 * El locale del portal, en un solo sitio.
 *
 * Convivían cuatro convenciones para decir lo mismo: `'es-BO'` en los workers,
 * `'es-ES'` en los contadores animados, `'es'` en las tablas y en el historial
 * de versiones, y —en tres vistas— la llamada SIN locale, que usa el del
 * navegador. Esa última no es un matiz de estilo: en un equipo configurado en
 * inglés, `/libraries`, `/qa-lab` y el contrato de una variable pintaban
 * `mm/dd/yyyy` mientras el resto del portal pintaba `dd/mm/yyyy`, y en una
 * pantalla de auditoría dos fechas con distinto orden de campos no se pueden
 * comparar de un vistazo. Una fecha ambigua en un expediente de crédito es un
 * defecto, no una preferencia.
 *
 * Fijarlo aquí también deja el cambio a otro mercado como una edición de una
 * línea, en vez de una cacería por 560 archivos.
 */
export const PORTAL_LOCALE = 'es-BO';

const DATE: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

const DATE_TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

/** Una fecha, sin hora. Devuelve `'—'` si no hay nada que formatear. */
export function formatDate(value: unknown): string {
  const parsed = toDate(value);
  return parsed ? parsed.toLocaleDateString(PORTAL_LOCALE, DATE) : '—';
}

/** Fecha y hora. Mismo contrato que `formatDate`. */
export function formatDateTime(value: unknown): string {
  const parsed = toDate(value);
  return parsed ? parsed.toLocaleString(PORTAL_LOCALE, DATE_TIME) : '—';
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(PORTAL_LOCALE, options);
}

/**
 * Una fecha utilizable, o `null`.
 *
 * El motor manda cadenas ISO, pero una vista puede recibir `null`, cadena vacía
 * o un texto que no es fecha; `new Date('lo que sea')` produce un `Invalid Date`
 * que se pinta como «Invalid Date» en pantalla si nadie lo comprueba.
 */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Sello de fecha para nombrar un archivo exportado, en la zona horaria de quien
 * exporta.
 *
 * `toISOString().slice(0, 10)` daba la fecha UTC: una exportación hecha a las
 * 21:30 en un huso al oeste de Greenwich salía con la fecha del día siguiente, y
 * el nombre del archivo es lo primero que se mira al reconstruir cuándo se sacó
 * un dato.
 */
export function localDateStamp(now: Date = new Date()): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
