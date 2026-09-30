'use client';

import { useCallback, useRef, useState, type RefObject } from 'react';
import { ApiError } from '../../api/ApiError';
import type { AssistConversation } from './assist.api';
import {
  deleteAssistConversation,
  getAssistConversationById,
  listAssistConversations,
  type AssistConversationSummary,
} from './assist-history.api';

/**
 * El historial de conversaciones del panel: la lista, abrir una para seguirla y borrarla.
 *
 * Su estado es APARTE del hilo: si la lista no carga, el panel lo dice dentro de la vista
 * «Historial» y el campo de pregunta sigue funcionando.
 */

export type HistoryPhase = 'idle' | 'loading' | 'ready' | 'error';

export const HISTORY_LIST_ERROR =
  'No se pudo cargar el historial. Puedes seguir preguntando y volver a intentarlo en un momento.';
export const HISTORY_OPEN_ERROR = 'No se pudo abrir esa conversación. Inténtalo de nuevo.';
export const HISTORY_GONE_ERROR = 'Esa conversación ya no existe.';
export const HISTORY_DELETE_ERROR = 'No se pudo borrar la conversación. Inténtalo de nuevo.';

interface Deps {
  activeId: string | null;
  /** Hay una pregunta en viaje: no se cambia de hilo debajo de ella. */
  inFlight: RefObject<boolean>;
  applyThread: (thread: AssistConversation) => void;
  /** Vacía el hilo vigente (se borró la conversación abierta). */
  reset: () => void;
}

export function useAssistHistory({ activeId, inFlight, applyThread, reset }: Deps) {
  const [phase, setPhase] = useState<HistoryPhase>('idle');
  const [items, setItems] = useState<AssistConversationSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const openToken = useRef(0);

  const loadList = useCallback(async () => {
    setPhase('loading');
    setNotice(null);
    try {
      setItems(await listAssistConversations());
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.conversationId !== id));
  }, []);

  /** Abre una conversación para continuarla. `true` si el hilo cambió (el panel vuelve al chat). */
  const openConversation = useCallback(
    async (id: string): Promise<boolean> => {
      if (inFlight.current) return false;
      const token = ++openToken.current;
      setBusyId(id);
      setNotice(null);
      try {
        const thread = await getAssistConversationById(id);
        if (token !== openToken.current) return false;
        applyThread({ ...thread, conversationId: thread.conversationId ?? id });
        return true;
      } catch (failure) {
        if (token !== openToken.current) return false;
        if (failure instanceof ApiError && failure.status === 404) {
          remove(id);
          setNotice(HISTORY_GONE_ERROR);
        } else setNotice(HISTORY_OPEN_ERROR);
        return false;
      } finally {
        if (token === openToken.current) setBusyId(null);
      }
    },
    [applyThread, inFlight, remove],
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      setBusyId(id);
      setNotice(null);
      try {
        await deleteAssistConversation(id);
        remove(id);
        if (id === activeId) reset();
        return true;
      } catch {
        setNotice(HISTORY_DELETE_ERROR);
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [activeId, remove, reset],
  );

  return { phase, items, busyId, notice, loadList, openConversation, deleteConversation };
}
