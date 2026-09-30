import { z } from 'zod';
import { authorizedFetch } from '../../api/http-client';
import { parseResponse } from '../../api/response';
import {
  ASSIST_SURFACE,
  envelope,
  type AssistConversation,
  fetchAssistConversationById,
} from './assist.api';

/**
 * El historial de conversaciones del asistente: listar, abrir y borrar. Mismo camino que el resto
 * (`/atlas-backend/*` hasta Core) y misma superficie; Core decide de quién son las conversaciones.
 */

const BASE = '/atlas-backend/internal/assist/conversations';

const summarySchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().nullish(),
  updatedAt: z.string(),
  turnCount: z.number().int().nonnegative().catch(0),
});
const listSchema = z.object({ conversations: z.array(summarySchema) });
const deletedSchema = z.object({ deleted: z.number() });

export type AssistConversationSummary = z.infer<typeof summarySchema>;

/** Las conversaciones de esta persona en el Motor, de la más reciente a la más antigua (máx. 30). */
export async function listAssistConversations(
  signal?: AbortSignal,
): Promise<AssistConversationSummary[]> {
  const response = await authorizedFetch(`${BASE}?surface=${ASSIST_SURFACE}`, { signal });
  const list = await parseResponse(response, envelope(listSchema));
  return list.conversations;
}

/** Una conversación con todos sus turnos, para abrirla y seguirla. 404 si ya no existe. */
export function getAssistConversationById(id: string): Promise<AssistConversation> {
  return fetchAssistConversationById(`${BASE}/${encodeURIComponent(id)}?surface=${ASSIST_SURFACE}`);
}

/** Borra una conversación. `deleted` es 0 si ya no existía. */
export async function deleteAssistConversation(id: string): Promise<{ deleted: number }> {
  const response = await authorizedFetch(
    `${BASE}/${encodeURIComponent(id)}?surface=${ASSIST_SURFACE}`,
    { method: 'DELETE' },
  );
  return parseResponse(response, envelope(deletedSchema));
}
