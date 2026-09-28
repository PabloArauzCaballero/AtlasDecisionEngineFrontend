'use client';

import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../../api/ApiError';
import {
  askAssist,
  assistErrorMessage,
  fetchAssistConversation,
  isAssistDisabled,
  type AssistConversation,
} from './assist.api';

/**
 * El hilo con el asistente, del lado de la pantalla.
 *
 * Vive en el botón flotante y no en el panel: el panel se monta al abrirse y se desmonta al
 * cerrarse, y la conversación —y la pregunta que se quedó sin respuesta— tiene que sobrevivir a eso.
 *
 * ## El 404 NO esconde el botón
 *
 * Con el asistente apagado en el ambiente, Core contesta 404 `ASSIST_DISABLED`. El botón sigue a la
 * vista y el panel lo dice con todas las letras; esconderlo era precisamente la queja: «no aparece».
 */

export type AssistBubble = {
  id: string;
  role: 'person' | 'assistant';
  text: string;
  suggestHandoff?: boolean;
  /** Respondió la guía sin pasar por el modelo (`mode: 'sin-ia'`). */
  noAi?: boolean;
};

/** `idle`: aún no se abrió; `disabled`: apagado en este ambiente. */
export type AssistStatus = 'idle' | 'loading' | 'ready' | 'disabled';

export type SendOutcome = 'sent' | 'failed' | 'rejected' | 'ignored';

type Pending = { text: string; clientMessageId: string };

/** UUID v4. `randomUUID` no existe fuera de un contexto seguro (un portal servido por http a una IP). */
export function newClientMessageId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toBubbles(conversation: AssistConversation): AssistBubble[] {
  return conversation.turns.flatMap((turn) => [
    { id: `${turn.turnId}-p`, role: 'person' as const, text: turn.prompt },
    {
      id: turn.turnId,
      role: 'assistant' as const,
      text: turn.reply,
      suggestHandoff: turn.suggestHandoff,
    },
  ]);
}

export function useAssist() {
  const [status, setStatus] = useState<AssistStatus>('idle');
  const [bubbles, setBubbles] = useState<AssistBubble[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  // En estado y no leído de `pending`: una referencia no se lee al pintar.
  const [retryable, setRetryable] = useState(false);
  const conversationId = useRef<string | null>(null);
  const pending = useRef<Pending | null>(null);
  // El candado es «hay una petición en viaje»: mientras tanto no se envía ni se recarga nada.
  const inFlight = useRef(false);

  /** Rehidrata el hilo al abrir el panel. Un fallo de lectura no impide preguntar. */
  const load = useCallback(async () => {
    if (inFlight.current) return;
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    try {
      const conversation = await fetchAssistConversation();
      if (inFlight.current) return;
      conversationId.current = conversation.conversationId;
      const unanswered = pending.current;
      setBubbles([
        ...toBubbles(conversation),
        ...(unanswered
          ? [{ id: unanswered.clientMessageId, role: 'person' as const, text: unanswered.text }]
          : []),
      ]);
      setHistoryFailed(false);
      setStatus('ready');
    } catch (failure) {
      if (isAssistDisabled(failure)) {
        setStatus('disabled');
        return;
      }
      setHistoryFailed(true);
      setStatus('ready');
    }
  }, []);

  const send = useCallback(async (raw: string, screen?: string): Promise<SendOutcome> => {
    const text = raw.trim();
    if (!text || inFlight.current) return 'ignored';

    // Reintentar la MISMA pregunta viaja con la misma clave: Core devuelve la respuesta ya pagada.
    const reuse = pending.current?.text === text ? pending.current : null;
    const entry = reuse ?? { text, clientMessageId: newClientMessageId() };
    pending.current = entry;
    inFlight.current = true;
    setSending(true);
    setError(null);
    setRetryable(false);
    if (!reuse) {
      setBubbles((current) => [
        ...current,
        { id: entry.clientMessageId, role: 'person', text: entry.text },
      ]);
    }

    try {
      const answer = await askAssist({
        prompt: entry.text,
        clientMessageId: entry.clientMessageId,
        conversationId: conversationId.current,
        screen,
      });
      conversationId.current = answer.conversationId ?? conversationId.current;
      pending.current = null;
      setBubbles((current) => [
        ...current,
        {
          id: answer.turnId ?? `${entry.clientMessageId}-r`,
          role: 'assistant',
          text: answer.reply,
          suggestHandoff: answer.suggestHandoff,
          noAi: answer.mode === 'sin-ia',
        },
      ]);
      return 'sent';
    } catch (failure) {
      if (isAssistDisabled(failure)) {
        pending.current = null;
        setStatus('disabled');
        return 'failed';
      }
      setError(assistErrorMessage(failure));
      // Rechazada tal como está: se devuelve al campo para reescribirla, con una clave nueva.
      if (failure instanceof ApiError && failure.code === 'ASSIST_REJECTED') {
        pending.current = null;
        setBubbles((current) => current.filter((bubble) => bubble.id !== entry.clientMessageId));
        return 'rejected';
      }
      setRetryable(true);
      return 'failed';
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, []);

  /** Vuelve a enviar la pregunta que se quedó sin respuesta, con su misma clave. */
  const retry = useCallback(
    (screen?: string) => (pending.current ? send(pending.current.text, screen) : undefined),
    [send],
  );

  return {
    status,
    bubbles,
    sending,
    error,
    historyFailed,
    canRetry: retryable,
    load,
    send,
    retry,
  };
}
