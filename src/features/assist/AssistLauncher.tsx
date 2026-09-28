'use client';

import { MessageCircleQuestion } from 'lucide-react';
import { useState } from 'react';
import { AssistPanel } from './AssistPanel';
import { useAssist } from './useAssist';

/**
 * El botón flotante del asistente, en todas las pantallas con sesión del portal.
 *
 * Se monta en el armazón (`NextAppShell`) y no en cada página: así aparece también en las vistas
 * futuras sin que nadie se acuerde de ponerlo, y el hilo sobrevive a cambiar de pantalla. No vive
 * en `(auth)`: sin sesión no hay a quién preguntar.
 *
 * Nunca se esconde. Si el asistente está apagado en el ambiente, el panel lo dice.
 */
export function AssistLauncher() {
  const [open, setOpen] = useState(false);
  const assist = useAssist();
  const { load } = assist;

  const openPanel = () => {
    setOpen(true);
    void load();
  };

  return (
    <>
      <button
        type="button"
        className="assist-fab"
        aria-label="Asistente de Atlas"
        title="Pregúntale al asistente"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tutorial-id="assist-launcher"
        onClick={openPanel}
      >
        <MessageCircleQuestion aria-hidden="true" />
      </button>
      {open ? <AssistPanel assist={assist} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
