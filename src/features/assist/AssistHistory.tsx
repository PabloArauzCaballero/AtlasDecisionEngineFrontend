'use client';

import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AssistConversationSummary } from './assist-history.api';
import { countMessages, formatRelative } from './assist-time';
import { HISTORY_LIST_ERROR } from './useAssistHistory';
import type { useAssist } from './useAssist';

type Assist = ReturnType<typeof useAssist>;

interface AssistHistoryProps {
  assist: Assist;
  /** «Volver al chat». */
  onBack: () => void;
  /** Se abrió una conversación: el panel vuelve al chat con ese hilo. */
  onOpened: () => void;
}

/**
 * La vista «Historial de conversaciones» dentro del panel: título, fecha y cantidad de mensajes.
 * Tocar una conversación la abre para seguirla; borrar pide confirmación EN LA FILA (sin cuadros
 * del navegador) para no perder un hilo por un toque de más.
 */
export function AssistHistory({ assist, onBack, onOpened }: AssistHistoryProps) {
  const { history, activeId, sending } = assist;
  const { phase, items, busyId, notice, loadList, openConversation } = history;
  const [confirming, setConfirming] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadList();
    root.current?.querySelector('button')?.focus();
  }, [loadList]);

  const open = async (id: string) => {
    if (await openConversation(id)) onOpened();
  };

  return (
    <div className="assist-history" ref={root}>
      <div className="assist-history-head">
        <h3>Historial de conversaciones</h3>
        <button className="button" type="button" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> Volver al chat
        </button>
      </div>

      <div className="assist-history-body">
        {notice ? (
          <p className="assist-history-alert" role="alert">
            {notice}
          </p>
        ) : null}

        {phase === 'loading' && items.length === 0 ? (
          <p className="assist-state" role="status">
            <Loader2 className="assist-spin" size={15} aria-hidden="true" /> Cargando tus
            conversaciones…
          </p>
        ) : null}

        {phase === 'error' ? (
          <div className="assist-history-alert" role="alert">
            <p>{HISTORY_LIST_ERROR}</p>
            <button className="button" type="button" onClick={() => void loadList()}>
              Reintentar
            </button>
          </div>
        ) : null}

        {phase === 'ready' && items.length === 0 ? (
          <p className="assist-history-empty">
            Todavía no tienes conversaciones guardadas. Haz una pregunta y aparecerá aquí.
          </p>
        ) : null}

        <ul className="assist-history-list">
          {items.map((item) => (
            <HistoryRow
              key={item.conversationId}
              item={item}
              current={item.conversationId === activeId}
              busy={busyId === item.conversationId}
              blocked={busyId !== null || sending}
              confirming={confirming === item.conversationId}
              onOpen={() => void open(item.conversationId)}
              onAskDelete={() => setConfirming(item.conversationId)}
              onCancel={() => setConfirming(null)}
              onDelete={async () => {
                await history.deleteConversation(item.conversationId);
                setConfirming(null);
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

interface RowProps {
  item: AssistConversationSummary;
  current: boolean;
  busy: boolean;
  blocked: boolean;
  confirming: boolean;
  onOpen: () => void;
  onAskDelete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function HistoryRow({
  item,
  current,
  busy,
  blocked,
  confirming,
  onOpen,
  onAskDelete,
  onCancel,
  onDelete,
}: RowProps) {
  const title = item.title?.trim() || 'Conversación sin título';
  const meta = [formatRelative(item.updatedAt), countMessages(item.turnCount)]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className={`assist-history-row${current ? ' is-current' : ''}`}>
      {confirming ? (
        <div className="assist-history-confirm" role="group" aria-label={`Borrar «${title}»`}>
          <p>¿Borrar «{title}»? No se puede deshacer.</p>
          <div className="assist-history-confirm-actions">
            <button
              className="button button-danger"
              type="button"
              onClick={onDelete}
              disabled={blocked}
              aria-busy={busy}
            >
              Sí, borrar
            </button>
            <button className="button" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            className="assist-history-open"
            type="button"
            onClick={onOpen}
            disabled={blocked}
            aria-current={current ? 'true' : undefined}
          >
            <span className="assist-history-title">{title}</span>
            <span className="assist-history-meta">{busy ? 'Abriendo…' : meta}</span>
          </button>
          <button
            className="assist-history-delete"
            type="button"
            onClick={onAskDelete}
            disabled={blocked}
            aria-label={`Borrar la conversación «${title}»`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </>
      )}
    </li>
  );
}
