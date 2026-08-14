'use client';

import type { FocusEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useHintBubble } from '../hooks/useHintBubble';

/**
 * Tooltip accesible: aparece al pasar el cursor y también al enfocar el control
 * interno con el teclado. El texto se marca con `role="tooltip"`; el nombre
 * accesible del control va en su `aria-label`.
 *
 * El globo se monta en `document.body` y `useHintBubble` lo coloca con
 * coordenadas fijas: dentro del disparador quedaba preso de su contexto de
 * apilamiento (tapado por barras y cabeceras pegajosas) y de cualquier
 * `overflow` (recortado en tablas). El globo está siempre montado —con
 * opacidad 0— para que el lector de pantalla y las pruebas lo encuentren sin
 * abrirlo, igual que antes.
 */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const { wrapRef, bubbleRef, open, placement, show, hide } = useHintBubble();
  return (
    <span
      className="tooltip-wrap"
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(event: FocusEvent<HTMLSpanElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) hide();
      }}
    >
      {children}
      {typeof document === 'undefined'
        ? null
        : createPortal(
            <span
              className="tooltip-bubble"
              role="tooltip"
              ref={bubbleRef}
              data-open={open || undefined}
              data-placement={placement}
            >
              {content}
            </span>,
            document.body,
          )}
    </span>
  );
}
