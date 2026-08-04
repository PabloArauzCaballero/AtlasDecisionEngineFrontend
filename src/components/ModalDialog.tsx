'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface ModalDialogProps {
  title: string;
  subtitle?: string;
  tone?: 'default' | 'danger';
  icon?: ReactNode;
  children: ReactNode;
  /** Action buttons rendered in the footer, in DOM order. */
  actions?: ReactNode;
  onClose: () => void;
}

/**
 * Small general-purpose modal (confirmations, error reports). Heavy authoring
 * flows keep their dedicated dialogs; this one covers the quick interrupts.
 */
export function ModalDialog({
  title,
  subtitle,
  tone = 'default',
  icon,
  children,
  actions,
  onClose,
}: ModalDialogProps) {
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog);
  /*
   * El diálogo se monta en `document.body`, no donde se declara.
   *
   * `position: fixed` se posiciona respecto al viewport SALVO que algún
   * ancestro tenga `transform`, `filter`, `perspective` o `contain`: entonces
   * ese ancestro pasa a ser el bloque contenedor. `.route-view` anima su entrada
   * con `animation-fill-mode: both`, que deja fijado el estado final de la
   * animación —incluido un `transform` identidad, invisible— para siempre. El
   * resultado medido: el fondo del modal empezaba en `top: -399` y medía 2021 px
   * (la página entera), así que la tarjeta se centraba respecto al documento y
   * aparecía abajo y cortada. Le pasaba a TODOS los modales, no sólo a exportar.
   *
   * Sacarlo del árbol de la ruta lo inmuniza: da igual qué transforme quien lo
   * declare, porque ya no es su descendiente.
   */

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  /*
   * Se comprueba `document` en vez de esperar a un estado de «montado». Ese
   * atajo obliga a un segundo render, y en el primero —el que devuelve null— el
   * efecto que atrapa el foco corre con la referencia todavía vacía: la trampa
   * quedaba desarmada y el tabulador se escapaba del diálogo. El diálogo sólo
   * aparece tras una interacción, así que nunca está en el HTML del servidor y
   * no hay desajuste de hidratación que temer.
   */
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className={tone === 'danger' ? 'modal-dialog modal-danger' : 'modal-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-heading">
          {icon ? (
            <span className="modal-heading-icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          <button className="icon-button" type="button" aria-label="Cerrar" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {actions ? <footer className="modal-actions">{actions}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
