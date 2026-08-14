import { apiRequest } from '../../api/http-client';

/**
 * Integridad de la cadena de auditoría y métricas agregadas.
 *
 * Las dos operaciones existían en el motor y no tenían pantalla. La de integridad era la más
 * cara de las dos: **sólo se podía comprobar por consola, que es justo donde no mira quien
 * audita**. Una cadena de hashes que nadie verifica no es una garantía, es una promesa.
 */

/** Por qué un eslabón no verifica. Los tres motivos significan cosas distintas. */
export type MotivoInvalido = 'PREVIOUS_HASH_MISMATCH' | 'HASH_MISMATCH' | 'HASH_KEY_UNAVAILABLE';

export interface EventoInvalido {
  readonly id: string;
  readonly reason: MotivoInvalido | string;
}

export interface VerificacionCadena {
  readonly valid: boolean;
  readonly eventCount: number;
  /** `null` cuando el tenant todavía no tiene ningún evento. No es un fallo. */
  readonly headHash: string | null;
  readonly invalid: readonly EventoInvalido[];
}

export interface MetricasAuditoria {
  readonly total: number;
  readonly outcomes: readonly { outcome: string | null; count: number }[];
  readonly statuses: readonly { status: string; count: number }[];
  readonly latencyMs: {
    readonly _avg?: Record<string, number | null>;
    readonly _max?: Record<string, number | null>;
    readonly _min?: Record<string, number | null>;
  };
}

export function verifyAuditChain(signal?: AbortSignal): Promise<VerificacionCadena> {
  return apiRequest<VerificacionCadena>('/v1/audit/chain/verify', { signal });
}

export function fetchAuditMetrics(signal?: AbortSignal): Promise<MetricasAuditoria> {
  return apiRequest<MetricasAuditoria>('/v1/audit/metrics', { signal });
}

/**
 * Qué significa cada motivo, en una frase que se pueda leer sin saber criptografía.
 *
 * Los tres se parecen y llevan a sitios distintos, y confundirlos cuesta caro: dos son un
 * incidente de integridad y el tercero es un problema de configuración. Poner los tres bajo
 * «la cadena falló» haría buscar una manipulación donde sólo falta una variable de entorno.
 */
export const MOTIVOS: Record<string, { titulo: string; explicacion: string; incidente: boolean }> =
  {
    PREVIOUS_HASH_MISMATCH: {
      titulo: 'La cadena se rompió',
      explicacion:
        'Este evento no enlaza con el anterior. Falta un eslabón o se insertó algo entre medias.',
      incidente: true,
    },
    HASH_MISMATCH: {
      titulo: 'El evento fue alterado',
      explicacion:
        'El contenido del evento ya no corresponde a su firma: alguien lo cambió después de ' +
        'escribirlo.',
      incidente: true,
    },
    HASH_KEY_UNAVAILABLE: {
      titulo: 'No se puede comprobar',
      explicacion:
        'El secreto con el que se firmó este evento ya no está configurado. NO significa que ' +
        'haya sido manipulado: significa que hoy no se puede afirmar ni lo uno ni lo otro. Se ' +
        'arregla restaurando la clave, no revisando el evento.',
      incidente: false,
    },
  };

/**
 * El tono de la verificación.
 *
 * Tres estados y no dos, por la misma razón que gobierna las pantallas de medición: **«no se
 * pudo comprobar» no es «está mal»**. Una cadena entera sin clave pintada en rojo manda a
 * investigar una manipulación que no ocurrió; pintada en verde, esconde que no se comprobó nada.
 */
export function tonoVerificacion(
  resultado: VerificacionCadena,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (resultado.eventCount === 0) return 'neutral';
  if (resultado.valid) return 'success';
  const hayIncidente = resultado.invalid.some((evento) => MOTIVOS[evento.reason]?.incidente);
  return hayIncidente ? 'danger' : 'warning';
}
