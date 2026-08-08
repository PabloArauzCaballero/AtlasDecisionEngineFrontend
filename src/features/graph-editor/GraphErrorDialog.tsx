'use client';

import { AlertCircle, GraduationCap } from 'lucide-react';
import { errorMessage } from '../../api/ApiError';
import { ModalDialog } from '../../components/ModalDialog';
import { tutorialCodeFor } from '../tutorial/error-tutorial';
import { errorTutorial } from '../tutorial/interactive-catalog';
import { useInteractiveTutorial } from '../tutorial/useInteractiveTutorial';

interface GraphErrorDialogProps {
  error: unknown;
  /** Qué se estaba haciendo: cambia el subtítulo, no el mensaje. */
  whileSaving: boolean;
  onDismiss: () => void;
}

/**
 * Un fallo del motor no queda en un mensaje técnico opaco: el diálogo usa la
 * explicación del catálogo y ofrece el recorrido que enseña a corregirlo.
 *
 * El recorrido guiado va DENTRO del diálogo: antes el mismo fallo llegaba
 * además como aviso, y era ahí donde estaba la única forma de llegar al
 * tutorial.
 */
export function GraphErrorDialog({ error, whileSaving, onDismiss }: GraphErrorDialogProps) {
  const { startForError } = useInteractiveTutorial();
  const code = tutorialCodeFor(error);
  const link = code ? errorTutorial(code) : null;

  return (
    <ModalDialog
      title={link ? link.title : 'No se pudo completar la operación'}
      subtitle={whileSaving ? 'Al guardar el algoritmo' : 'Al cargar la versión'}
      tone="danger"
      icon={<AlertCircle size={20} />}
      onClose={onDismiss}
      actions={
        <>
          {link ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                onDismiss();
                startForError(code as string);
              }}
            >
              <GraduationCap size={16} /> Ver tutorial guiado
            </button>
          ) : null}
          <button type="button" className="button button-primary" onClick={onDismiss}>
            Cerrar
          </button>
        </>
      }
    >
      <p>{link ? link.description : errorMessage(error)}</p>
    </ModalDialog>
  );
}
