'use client';

import { AlertTriangle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ModalDialog } from './ModalDialog';

interface ConfirmButtonProps {
  /** Qué se va a destruir, en la pregunta: «¿Eliminar el nodo Rechazo?». */
  title: string;
  /** La consecuencia concreta. Sin esto la pregunta no aporta nada. */
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Nombre accesible cuando el botón es sólo un icono. */
  label?: string;
}

/**
 * Botón que destruye algo, con confirmación obligatoria.
 *
 * Un borrado no se puede deshacer con Ctrl+Z: en el editor de grafo quita el
 * nodo y sus conexiones, y en el banco cambia lo que un algoritmo hace. La
 * confirmación no es burocracia, es el único punto donde se puede decir qué se
 * pierde antes de perderlo —por eso `description` es obligatorio y debe nombrar
 * la consecuencia, no repetir el título—.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel = 'Eliminar',
  onConfirm,
  children,
  className = 'button button-danger',
  disabled,
  label,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button
        className={className}
        type="button"
        disabled={disabled}
        aria-label={label}
        onClick={() => setAsking(true)}
      >
        {children}
      </button>
      {asking ? (
        <ModalDialog
          title={title}
          tone="danger"
          icon={<AlertTriangle size={18} />}
          onClose={() => setAsking(false)}
          actions={
            <>
              <button className="button" type="button" onClick={() => setAsking(false)}>
                Cancelar
              </button>
              <button
                className="button button-danger"
                type="button"
                onClick={() => {
                  setAsking(false);
                  onConfirm();
                }}
              >
                {confirmLabel}
              </button>
            </>
          }
        >
          {description}
        </ModalDialog>
      ) : null}
    </>
  );
}
