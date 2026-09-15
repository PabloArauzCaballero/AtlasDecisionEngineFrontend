'use client';

import { HelpCircle } from 'lucide-react';
import { useId, type FocusEvent } from 'react';
import { createPortal } from 'react-dom';
import { useHintBubble } from '../hooks/useHintBubble';

interface InfoHintProps {
  /** Plain-language explanation shown on hover/focus. */
  text: string;
  /** Accessible label for the trigger; defaults to a generic phrasing. */
  label?: string;
  /**
   * `id` del `<span>` oculto con el texto, al que apunta el `aria-describedby`
   * del control. Sin él la ayuda sólo existe para quien ve el icono.
   */
  describedById?: string;
  /** El control asociado tiene el foco: la burbuja se abre sin tocar el icono. */
  forceOpen?: boolean;
}

/** `:focus-visible` decide si el foco vino del teclado; jsdom puede no soportarlo. */
function focusCameFromKeyboard(trigger: HTMLElement): boolean {
  try {
    return trigger.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * La burbuja de ayuda de un campo (el `FieldTooltip` de la especificación común):
 * qué poner y por qué importa.
 *
 * Aimed at non-technical analysts: it demystifies domain jargon (outcome, SLA,
 * cobertura…) without cluttering the layout.
 *
 * El globo se monta en `document.body` y `useHintBubble` lo coloca con
 * coordenadas fijas — dentro del disparador quedaba tapado por barras y
 * cabeceras pegajosas y recortado por contenedores con `overflow`. Sigue
 * siempre montado (opacidad 0): `aria-describedby` lo encuentra por id esté
 * donde esté.
 *
 * **El nombre accesible del botón sale de `title`, NO de `aria-label`.** Medido
 * en el ERP (`partner-dossier.spec.ts`): con `aria-label="Ayuda: Ciudad"`, un
 * `getByLabel('Ciudad')` de Playwright casa también con el botón de ayuda —y,
 * cuando el icono vive dentro de la `<label>`, ese texto entra además en el
 * nombre accesible del propio campo—. Con `title` el botón sigue teniendo nombre
 * para el lector de pantalla y deja de contaminar el del control.
 */
export function InfoHint({
  text,
  label = 'Más información',
  describedById,
  forceOpen,
}: InfoHintProps) {
  const id = useId();
  const { wrapRef, bubbleRef, open, placement, show, hide } = useHintBubble(forceOpen);
  return (
    <span className="info-hint" ref={wrapRef} onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        className="info-hint-trigger"
        title={label}
        aria-describedby={id}
        onFocus={(event: FocusEvent<HTMLButtonElement>) => {
          if (focusCameFromKeyboard(event.currentTarget)) show();
        }}
        onBlur={hide}
      >
        <HelpCircle size={14} aria-hidden="true" />
      </button>
      {describedById ? (
        <span id={describedById} className="sr-only">
          {text}
        </span>
      ) : null}
      {typeof document === 'undefined'
        ? null
        : createPortal(
            <span
              role="tooltip"
              id={id}
              className="info-hint-bubble"
              ref={bubbleRef}
              data-open={open || undefined}
              data-placement={placement}
            >
              {text}
            </span>,
            document.body,
          )}
    </span>
  );
}

/** Alias con el nombre de la especificación común; misma pieza, mismo archivo. */
export const FieldTooltip = InfoHint;
