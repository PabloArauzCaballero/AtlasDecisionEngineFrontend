/**
 * Contrato del worker de locución, visto desde el portal.
 *
 * Espejo de lo que publica el motor en `/v1/workers/audio-tts`. **No es
 * autoritativo**: el backend revalida siempre. Sirve para pintar la vista y
 * para explicar en español lo que el resultado dice en códigos.
 */

/** Los cuatro finales de una locución, tal como los define el motor. */
export const AUDIO_OUTCOMES = ['READY', 'QUEUED', 'FALLBACK', 'UNAVAILABLE'] as const;
export type AudioOutcome = (typeof AUDIO_OUTCOMES)[number];

/** Cómo se compuso el audio cuando el motor lo ensambló por tramos cacheados. */
export interface AudioSegmentsSummary {
  total: number;
  cached: number;
  generated: number;
}

export interface AudioRunResult {
  outcome: AudioOutcome;
  cacheHit: boolean;
  generated: boolean;
  audioAvailable: boolean;
  reason: string | null;
  /**
   * `null` en audio generado de una pieza. Cuando existe, el audio se COSIÓ:
   * la prosodia no es la de una toma continua, y decirlo es parte del contrato.
   */
  segments: AudioSegmentsSummary | null;

  templateCode: string | null;
  templateVersion: number | null;
  language: string | null;
  provider: string | null;
  model: string | null;
  voiceProfile: string | null;
  voiceVersion: number | null;
  outputFormat: string | null;
  sampleRate: number | null;

  mimeType: string | null;
  bytes: number | null;
  checksumSha256: string | null;
}

export interface AudioTemplate {
  code: string;
  version: number;
  strategy: 'STATIC' | 'DYNAMIC' | 'FALLBACK';
  templateText: string;
  language: string | null;
  variables: string[];
  isActive: boolean;
}

/**
 * Qué se sirvió, en una frase.
 *
 * Los cuatro finales NO son grados de éxito: son cuatro cosas distintas que le
 * pasan a quien esperaba oír algo. Enseñar el código del motor obligaría a
 * traducirlo mentalmente cada vez, y «QUEUED» junto a un reproductor vacío se
 * lee como un error cuando en realidad es «se está generando».
 */
export const OUTCOME_LABEL: Record<AudioOutcome, string> = {
  READY: 'Servido de caché',
  QUEUED: 'Generado ahora',
  FALLBACK: 'Se sirvió el respaldo',
  UNAVAILABLE: 'Sin audio',
};

export const OUTCOME_HELP: Record<AudioOutcome, string> = {
  READY: 'Esta frase ya estaba locutada con esta misma voz. No costó nada volver a servirla.',
  QUEUED:
    'No existía y se generó en esta ejecución. La próxima vez que se pida la misma frase con la misma voz saldrá de la caché.',
  FALLBACK:
    'No se pudo generar lo que se pidió y sonó el audio de respaldo. Dice algo genérico: conviene revisar el motivo antes de darlo por bueno.',
  UNAVAILABLE:
    'No hay audio para esta locución y tampoco respaldo. Quien la pidió debe continuar sin audio, nunca tratarlo como un fallo del usuario.',
};

/**
 * Color de la insignia del desenlace.
 *
 * Vocabulario cerrado de `StatusBadge`, igual que en `worker-types.ts`: un
 * valor fuera de él cae en «neutral» sin avisar. El respaldo y la ausencia de
 * audio van en ámbar y no en rojo — no son fallos, son avisos: el contrato del
 * worker es que la falta de audio nunca rompe a quien lo pide.
 */
export function outcomeTone(outcome: AudioOutcome): string {
  if (outcome === 'READY' || outcome === 'QUEUED') return 'PASSED';
  return 'WARNING';
}

/** Las variables que declara una plantilla, sin repetir. */
export function templateVariables(template: AudioTemplate | undefined): string[] {
  return template ? [...new Set(template.variables)] : [];
}

/**
 * ¿Está el formulario listo para enviar?
 *
 * Falta una variable ⇒ no. El motor las exige todas y responde
 * `AUDIO_TEMPLATE_VARIABLE_MISSING`, así que dejar pulsar el botón sólo
 * convierte un aviso inmediato en una ejecución fallida que hay que ir a leer.
 */
export function missingVariables(
  template: AudioTemplate | undefined,
  values: Record<string, string>,
): string[] {
  return templateVariables(template).filter((name) => !(values[name] ?? '').trim());
}

/**
 * Tamaño legible del audio.
 *
 * En KiB desde el primer byte: un audio de una frase pesa decenas de miles de
 * bytes, y «48 384 B» obliga a dividir mentalmente para saber si eso es mucho.
 */
export function formatBytes(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  return kib < 1024 ? `${kib.toFixed(1)} KiB` : `${(kib / 1024).toFixed(2)} MiB`;
}

/**
 * Qué costó esta locución.
 *
 * Son TRES casos y no dos, y confundirlos afirma un gasto que no ocurrió:
 * derivarlo sólo de `cacheHit` decía «se generó» sobre una ejecución que había
 * servido el respaldo precisamente porque NO se pudo generar nada.
 */
export function costLabel(result: AudioRunResult): string {
  if (result.cacheHit) return 'Ninguno: estaba en caché';
  if (result.generated) return 'Se generó en esta ejecución';
  return 'Ninguno: no se llegó a generar';
}

/**
 * Cómo se compuso el audio, en una línea.
 *
 * «3 de caché, 1 generado» es la cifra que explica el ahorro del worker: los
 * tramos fijos de la plantilla ya estaban pagados y esta ejecución sólo pagó
 * sus variables. `null` cuando el audio salió de una pieza — no se enseña nada,
 * porque «sin segmentos» no es un dato que ayude a decidir.
 */
export function segmentsLabel(result: AudioRunResult): string | null {
  const segments = result.segments;
  if (!segments || typeof segments.total !== 'number') return null;
  const cosido = `Ensamblado con ${String(segments.total)} tramos`;
  const detalle = `${String(segments.cached)} de caché, ${String(segments.generated)} generados`;
  return `${cosido}: ${detalle}`;
}

/**
 * La voz con la que se dijo, en una línea.
 *
 * Perfil, versión y modelo juntos porque los tres decidieron cómo suena: el
 * mismo texto con otra versión de voz es otro audio, y sin la versión a la
 * vista dos locuciones distintas parecen la misma.
 */
export function voiceSummary(result: AudioRunResult): string | null {
  if (!result.voiceProfile) return null;
  const version = result.voiceVersion === null ? '' : ` v${result.voiceVersion}`;
  const model = result.model ? ` · ${result.model}` : '';
  return `${result.voiceProfile}${version}${model}`;
}
