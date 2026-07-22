'use client';

import { X } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
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
    </div>
  );
}
