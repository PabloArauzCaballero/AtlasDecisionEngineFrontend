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
  /**
   * Si devuelve una promesa, el diálogo se queda puesto y bloqueado hasta que se
   * resuelva: cerrarlo antes daría por hecho un borrado que aún no ha ocurrido.
   */
  onConfirm: () => void | Promise<unknown>;
  /** Qué dice el botón mientras la operación corre. No todo es un borrado. */
  runningLabel?: string;
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
  runningLabel = 'Procesando…',
  onConfirm,
  children,
  className = 'button button-danger',
  disabled,
  label,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  const [running, setRunning] = useState(false);

  /*
   * Un borrado no se pide dos veces.
   *
   * Antes se cerraba el diálogo y se llamaba en el mismo gesto, así que una
   * confirmación lenta seguía aceptando clics —y el doble clic, que es un
   * reflejo, mandaba dos peticiones—. Ahora el diálogo se queda mientras dura la
   * operación y sólo se retira cuando ha terminado de verdad.
   */
  const confirm = () => {
    if (running) return;
    const outcome = onConfirm();
    if (!(outcome instanceof Promise)) {
      setAsking(false);
      return;
    }
    setRunning(true);
    void outcome.finally(() => {
      setRunning(false);
      setAsking(false);
    });
  };

  /** Cerrar a media faena dejaría la pregunta resuelta sin saber en qué acabó. */
  const close = () => {
    if (!running) setAsking(false);
  };

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
          onClose={close}
          actions={
            <>
              <button className="button" type="button" disabled={running} onClick={close}>
                Cancelar
              </button>
              <button
                className="button button-danger"
                type="button"
                disabled={running}
                onClick={confirm}
              >
                {running ? runningLabel : confirmLabel}
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
