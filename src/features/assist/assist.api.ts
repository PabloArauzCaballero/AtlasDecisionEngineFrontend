import { z } from 'zod';
import { ApiError } from '../../api/ApiError';
import { authorizedFetch } from '../../api/http-client';
import { parseResponse } from '../../api/response';

/**
 * Atlas Assist, el asistente de ayuda, visto desde el portal del Motor.
 *
 * ## Por qué va a AtlasBackend y no al motor
 *
 * El asistente vive en AtlasBackend (Core): es quien conoce la identidad del personal y quien habla
 * con el servicio de IA con su propia clave, que nunca llega al navegador. Este portal ya tiene un
 * camino hasta Core, `/atlas-backend/*` (`src/server/atlas-backend-proxy.ts`), y la credencial es la
 * misma de la sesión: el token lo emite Core y el motor sólo lo reenvía. No hay variable nueva.
 *
 * `surface` es una PISTA: quien decide qué catálogo contesta es Core, no el navegador.
 *
 * ## `clientMessageId` se genera al enviar y SE CONSERVA al reintentar
 *
 * Es la clave con la que Core reconoce la misma pregunta. Un 409 `ASSIST_IN_FLIGHT` significa «la
 * misma consulta sigue en curso»: se espera lo que diga `Retry-After` y se repite CON LA MISMA clave,
 * que recoge la respuesta ya guardada en vez de pagar una segunda. Lo mismo con el 504 del proxy
 * (`ATLAS_BACKEND_TIMEOUT`): Core pudo haber contestado tarde, y repetir con la misma clave es seguro.
 */

export const ASSIST_SURFACE = 'risk-portal';

/** Tope del texto que acepta Core por pregunta. */
export const ASSIST_PROMPT_MAX = 2_000;

const CHAT_PATH = '/atlas-backend/internal/assist/chat';
const CONVERSATION_PATH = `/atlas-backend/internal/assist/conversation?surface=${ASSIST_SURFACE}`;

/** Cuántas veces se insiste en silencio ante «sigue en curso» antes de enseñar el error. */
const MAX_SILENT_RETRIES = 3;
const DEFAULT_WAIT_MS = 2_000;
const MAX_WAIT_MS = 10_000;

/** Una respuesta del modelo puede tardar más que el plazo por omisión del portal (15 s). */
const CHAT_TIMEOUT_MS = 60_000;

/** AtlasBackend envuelve toda respuesta en `{ requestId, data, timestamp }`; se admite pelada. */
function envelope<S extends z.ZodTypeAny>(schema: S) {
  return z.preprocess(
    (body) =>
      body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body,
    schema,
  );
}

const replySchema = z.object({
  reply: z.string(),
  suggestHandoff: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  conversationId: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  turnId: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  mode: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
});

const turnSchema = z.object({
  turnId: z.string(),
  prompt: z.string(),
  reply: z.string(),
  suggestHandoff: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  createdAt: z.string().nullish(),
});

const conversationSchema = z.object({
  conversationId: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  turns: z
    .array(turnSchema)
    .nullish()
    .transform((value) => value ?? []),
});

export type AssistReply = z.infer<typeof replySchema>;
export type AssistConversation = z.infer<typeof conversationSchema>;

export interface AssistQuestion {
  prompt: string;
  clientMessageId: string;
  conversationId?: string | null;
  screen?: string;
}

export interface AskOptions {
  signal?: AbortSignal;
  /** Espera entre reintentos; inyectable para las pruebas. */
  wait?: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `Retry-After` en segundos, acotado: un valor absurdo no puede dejar la pregunta colgada. */
export function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'));
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_WAIT_MS;
  return Math.min(seconds * 1_000, MAX_WAIT_MS);
}

/** Lo que se repite con la misma clave: la consulta sigue en curso o el proxy se cansó de esperar. */
function isStillRunning(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'ASSIST_IN_FLIGHT') return true;
  return error.status === 504 && error.code === 'ATLAS_BACKEND_TIMEOUT';
}

export async function askAssist(
  question: AssistQuestion,
  options: AskOptions = {},
): Promise<AssistReply> {
  const wait = options.wait ?? sleep;
  const body = {
    surface: ASSIST_SURFACE,
    prompt: question.prompt,
    clientMessageId: question.clientMessageId,
    ...(question.conversationId ? { conversationId: question.conversationId } : {}),
    ...(question.screen ? { screen: question.screen } : {}),
  };

  for (let attempt = 0; ; attempt += 1) {
    const response = await authorizedFetch(CHAT_PATH, {
      method: 'POST',
      body,
      signal: options.signal,
      timeoutMs: CHAT_TIMEOUT_MS,
    });
    try {
      return await parseResponse(response, envelope(replySchema));
    } catch (error) {
      if (!isStillRunning(error) || attempt >= MAX_SILENT_RETRIES) throw error;
      await wait(retryAfterMs(response));
    }
  }
}

/** El hilo vigente de esta persona en este portal, para rehidratar el panel al abrirlo. */
export function fetchAssistConversation(signal?: AbortSignal): Promise<AssistConversation> {
  return authorizedFetch(CONVERSATION_PATH, { signal }).then((response) =>
    parseResponse(response, envelope(conversationSchema)),
  );
}

/** Apagado en este ambiente: Core contesta 404 `ASSIST_DISABLED` en toda la superficie. */
export function isAssistDisabled(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'ASSIST_DISABLED' || error.status === 404);
}

/** El texto que ve la persona para cada fallo. Ninguno habla de servidores ni de códigos. */
export function assistErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'El asistente no pudo responder. Inténtalo de nuevo.';
  }
  // Core ya redacta este mensaje para la persona (tope de texto, datos sensibles…).
  if (error.code === 'ASSIST_REJECTED') return error.message;
  if (error.code === 'ASSIST_IN_FLIGHT') {
    return 'Tu pregunta anterior todavía se está respondiendo. Espera unos segundos y vuelve a intentarlo.';
  }
  if (error.code === 'ASSIST_BUSY' || error.status === 429) {
    return 'El asistente está atendiendo muchas consultas. Inténtalo de nuevo en un momento.';
  }
  if (error.kind === 'unauthorized') return 'Tu sesión venció. Inicia sesión nuevamente.';
  if (error.kind === 'forbidden') return 'Tu cuenta no tiene acceso al asistente en este portal.';
  if (error.code === 'ASSIST_UNAVAILABLE' || error.status === 503) {
    return 'El asistente no está disponible en este momento. Inténtalo más tarde.';
  }
  if (error.kind === 'network' || error.kind === 'timeout' || error.status >= 502) {
    return 'No se pudo conectar con el asistente. Inténtalo de nuevo en un momento.';
  }
  return 'El asistente no pudo responder. Inténtalo de nuevo.';
}
