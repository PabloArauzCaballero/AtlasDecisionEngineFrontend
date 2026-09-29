/**
 * Lectura del expediente del alta (`evidenceJson.alta`) que AtlasBackend adjunta al caso.
 *
 * El contrato lo arma AtlasBackend (versión 1) y cualquier bloque puede faltar o venir `null`. La
 * regla de esta pantalla es que lo ausente se diga: un «0» o una celda vacía donde no hubo dato se
 * lee como «no pasó nada», y en una revisión de fraude eso es exactamente lo que no se puede
 * suponer. Por eso los formateadores devuelven `null` ante la ausencia y la vista lo pinta como
 * «No disponible».
 */
import { asRecord, type UnknownRecord } from '../../utils/records';

export const NO_DISPONIBLE = 'No disponible';

/** El umbral con el que el artefacto de identidad escala por automatización (`bot_score >= 0.7`). */
export const BOT_SCORE_ALTO = 0.7;

export type Tono = 'riesgo' | 'aviso';

/** Una señal que el revisor tiene que mirar antes de decidir. */
export interface Senal {
  tono: Tono;
  texto: string;
}

export function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

/** El bloque como registro, o `null` si no vino (para poder decir «No disponible»). */
export function bloque(record: UnknownRecord, key: string): UnknownRecord | null {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? asRecord(value) : null;
}

export function lista(record: UnknownRecord | null, key: string): UnknownRecord[] | null {
  const value = record?.[key];
  return Array.isArray(value) ? value.map((item) => asRecord(item)) : null;
}

export function num(value: unknown): number | null {
  if (!isPresent(value) || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function siNo(value: unknown): string | null {
  if (value === true || value === 'true') return 'Sí';
  if (value === false || value === 'false') return 'No';
  return null;
}

export function texto(value: unknown): string | null {
  if (!isPresent(value)) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function numero(value: unknown, decimales = 0): string | null {
  const n = num(value);
  return n === null
    ? null
    : n.toLocaleString('es-BO', { maximumFractionDigits: decimales, minimumFractionDigits: 0 });
}

export function porcentaje(value: unknown): string | null {
  const n = num(value);
  return n === null ? null : `${Math.round(n * 100)} %`;
}

export function segundos(value: unknown): string | null {
  const n = num(value);
  if (n === null) return null;
  const total = Math.round(n);
  if (total < 60) return `${total} s`;
  const minutos = Math.floor(total / 60);
  return `${total} s (${minutos} min ${total % 60} s)`;
}

export function metros(value: unknown): string | null {
  const n = num(value);
  if (n === null) return null;
  return n >= 1000
    ? `${(n / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} km`
    : `${Math.round(n)} m`;
}

export function fecha(value: unknown): string | null {
  if (!isPresent(value)) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Enlace a Google Maps para un punto `{lat, lng}`; `null` si falta alguna coordenada. */
export function enlaceMapa(punto: unknown): { url: string; texto: string } | null {
  const record = punto && typeof punto === 'object' ? asRecord(punto) : null;
  const lat = num(record?.lat);
  const lng = num(record?.lng);
  if (lat === null || lng === null) return null;
  return {
    url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    texto: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  };
}

/** Las decisiones de permisos y consentimientos, en palabras. */
export function decision(value: unknown): string | null {
  const raw = texto(value);
  if (!raw) return null;
  const mapa: Record<string, string> = {
    granted: 'Concedido',
    denied: 'Denegado',
    limited: 'Limitado',
    blocked: 'Bloqueado',
    undetermined: 'Sin responder',
    accepted: 'Aceptado',
    rejected: 'Rechazado',
    revoked: 'Revocado',
  };
  return mapa[raw.toLowerCase()] ?? raw;
}

/**
 * Las señales de fraude o de mayor riesgo del expediente, para el resumen de arriba.
 *
 * Son las mismas que la vista marca en su sitio; juntarlas arriba evita que el revisor tenga que
 * recorrer diez bloques para enterarse de que el teléfono era un emulador.
 */
export function senalesDelAlta(alta: UnknownRecord): Senal[] {
  const senales: Senal[] = [];
  const declarado = bloque(alta, 'declarado');
  const carnet = bloque(alta, 'carnetVsDeclarado');
  const crono = bloque(alta, 'cronometro');
  const disp = bloque(alta, 'dispositivo');
  const pings = bloque(bloque(alta, 'ubicacion') ?? {}, 'pings');
  const agenda = bloque(alta, 'agenda');

  if (disp?.emulador === true)
    senales.push({ tono: 'riesgo', texto: 'El alta se hizo en un emulador' });
  if (disp?.rooteado === true) senales.push({ tono: 'riesgo', texto: 'El teléfono está rooteado' });
  if ((num(pings?.simulados) ?? 0) > 0)
    senales.push({ tono: 'riesgo', texto: `${num(pings?.simulados)} ubicaciones simuladas` });
  if (crono?.pegadoEnCarnet === true)
    senales.push({ tono: 'riesgo', texto: 'El número de carnet se pegó, no se escribió' });
  if ((num(crono?.botScore) ?? 0) >= BOT_SCORE_ALTO)
    senales.push({ tono: 'riesgo', texto: 'Comportamiento de automatización alto' });
  if (carnet?.coincideNombre === false)
    senales.push({ tono: 'riesgo', texto: 'El nombre declarado no coincide con el carnet' });
  if (carnet?.coincideNacimiento === false)
    senales.push({ tono: 'riesgo', texto: 'La fecha de nacimiento no coincide con el carnet' });
  if (declarado?.menorDe23 === true)
    senales.push({ tono: 'aviso', texto: 'Menor de 23 años: mayor riesgo' });
  if (crono?.segundoPlanoEnCaptura === true)
    senales.push({ tono: 'aviso', texto: 'La app pasó a segundo plano durante la captura' });
  if ((num(disp?.otrosClientesConEsteDispositivo) ?? 0) > 0)
    senales.push({ tono: 'aviso', texto: 'Otros clientes usaron este mismo teléfono' });
  if ((num(agenda?.coincidenciasRiesgo) ?? 0) > 0)
    senales.push({ tono: 'aviso', texto: 'La agenda tiene contactos marcados como riesgo' });
  return senales;
}
