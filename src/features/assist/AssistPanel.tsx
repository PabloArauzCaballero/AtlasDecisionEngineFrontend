'use client';

import { History, RotateCcw, SendHorizontal, SquarePen, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { ASSIST_PROMPT_MAX } from './assist.api';
import { AssistHistory } from './AssistHistory';
import { assistScreenFor } from './assist-screen';
import type { useAssist } from './useAssist';

type Assist = ReturnType<typeof useAssist>;

interface AssistPanelProps {
  assist: Assist;
  onClose: () => void;
}

/** Temas que el catálogo del Motor sí sabe contestar: la primera vista no es un campo en blanco. */
export const ASSIST_SUGGESTIONS = [
  '¿Cómo despliego una versión aprobada?',
  '¿Qué mide el PSI en Monitoreo del Modelo?',
  '¿Cómo creo un campo calculado en Python?',
] as const;

/** A partir de aquí se enseña cuánto queda: antes, el contador sólo es ruido. */
const COUNTER_FROM = ASSIST_PROMPT_MAX - 200;

export function AssistPanel({ assist, onClose }: AssistPanelProps) {
  const titleId = useId();
  const noticeId = useId();
  const dialog = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const newReasonId = useId();
  const pathname = usePathname() ?? '';
  const screen = assistScreenFor(pathname);
  useDialogFocus(dialog, input, onClose);

  const { status, bubbles, sending, error, historyFailed, canRetry, send, retry, startNew } =
    assist;
  const disabled = status === 'disabled';
  // La razón se dice en pantalla, no sólo en un `title`: un botón apagado no da foco ni tooltip fiable.
  const newReason = sending
    ? 'Espera a que el asistente responda para empezar otra.'
    : bubbles.length === 0
      ? 'Ya estás en una conversación nueva.'
      : '';

  // La respuesta nueva queda a la vista sin que haya que bajar a buscarla.
  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [bubbles.length, sending, error, view]);

  const submit = async (text: string = draft) => {
    const question = text.trim();
    if (!question || sending || disabled) return;
    setDraft('');
    const outcome = await send(question, screen);
    // Core la rechazó tal cual (p. ej. traía un dato sensible): vuelve al campo para corregirla.
    if (outcome === 'rejected') setDraft(question);
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  };

  return (
    <div
      className="assist-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className="assist-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={noticeId}
      >
        <header className="assist-head">
          <div>
            <h2 id={titleId}>Asistente de Atlas</h2>
            <p>{screen ? `Motor de decisión · ${screen}` : 'Motor de decisión'}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="assist-actions">
          <button
            className="button"
            type="button"
            disabled={newReason !== ''}
            aria-describedby={newReason ? newReasonId : undefined}
            onClick={() => {
              if (startNew()) setView('chat');
            }}
          >
            <SquarePen size={15} aria-hidden="true" /> Nueva conversación
          </button>
          <button
            className={`button${view === 'history' ? ' button-primary' : ''}`}
            type="button"
            aria-pressed={view === 'history'}
            onClick={() => setView('history')}
          >
            <History size={15} aria-hidden="true" /> Historial
          </button>
          {newReason ? (
            <p className="assist-actions-reason" id={newReasonId}>
              {newReason}
            </p>
          ) : null}
        </div>

        {view === 'history' ? (
          <AssistHistory
            assist={assist}
            onBack={() => setView('chat')}
            onOpened={() => setView('chat')}
          />
        ) : (
          <>
            <div className="assist-log" ref={log} role="log" aria-live="polite" aria-busy={sending}>
              {disabled ? (
                <p className="assist-state">
                  El asistente todavía no está encendido en este ambiente.
                </p>
              ) : status === 'loading' || status === 'idle' ? (
                <p className="assist-state">Cargando la conversación…</p>
              ) : bubbles.length === 0 ? (
                <div className="assist-empty">
                  <p>
                    Pregúntame cómo hacer algo en el Motor (validar una versión, probarla,
                    desplegarla) o una duda de riesgo crediticio, estadística o Python.
                  </p>
                  <div className="assist-suggestions">
                    {ASSIST_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        className="assist-suggestion"
                        type="button"
                        disabled={sending}
                        onClick={() => void submit(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {historyFailed && !disabled ? (
                <p className="assist-state">
                  No se pudo cargar la conversación anterior. Puedes preguntar igual.
                </p>
              ) : null}
              {bubbles.map((bubble) => (
                <div key={bubble.id} className={`assist-bubble assist-bubble-${bubble.role}`}>
                  <p>{bubble.text}</p>
                  {bubble.noAi ? (
                    <p className="assist-meta">Respuesta sin IA: texto de la guía.</p>
                  ) : null}
                </div>
              ))}
              {sending ? (
                <div
                  className="assist-bubble assist-bubble-assistant assist-thinking"
                  role="status"
                >
                  <p>Pensando…</p>
                </div>
              ) : null}
              {error && !disabled ? (
                <div className="assist-error" role="alert">
                  <p>{error}</p>
                  {canRetry ? (
                    <button className="button" type="button" onClick={() => void retry(screen)}>
                      <RotateCcw size={15} aria-hidden="true" /> Reintentar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <form
              className="assist-compose"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <p className="assist-notice" id={noticeId}>
                No escribas contraseñas, códigos ni datos personales.
              </p>
              <div className="assist-input-row">
                <textarea
                  ref={input}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                  maxLength={ASSIST_PROMPT_MAX}
                  rows={2}
                  disabled={disabled}
                  aria-label="Tu pregunta para el asistente"
                  placeholder={disabled ? 'No disponible en este ambiente' : 'Escribe tu pregunta…'}
                />
                <button
                  className="button button-primary assist-send"
                  type="submit"
                  disabled={disabled || sending || !draft.trim()}
                  aria-label="Enviar pregunta"
                >
                  <SendHorizontal size={16} aria-hidden="true" />
                </button>
              </div>
              {draft.length >= COUNTER_FROM ? (
                <p className="assist-counter">
                  {draft.length} de {ASSIST_PROMPT_MAX} caracteres
                </p>
              ) : null}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
