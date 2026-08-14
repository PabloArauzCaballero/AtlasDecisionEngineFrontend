'use client';

import { ShieldAlert } from 'lucide-react';
import { useRef } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface SessionExpiryDialogProps {
  /** Segundos que faltan, o `null` si no hay que avisar todavía. */
  secondsLeft: number | null;
  cause: 'idle' | 'absolute' | null;
  onStay: () => void;
  onLeave: () => void;
}

/**
 * Aviso previo al cierre de sesión.
 *
 * Cerrar sin avisar tira el trabajo a medias —un comentario de resolución a
 * medio escribir, un grafo sin guardar— y enseña a no fiarse del portal. El
 * aviso da dos minutos y una salida clara.
 *
 * La envoltura decide si hay diálogo y el interior lo dibuja. El corte no es
 * cosmético: `useDialogFocus` monta la trampa de foco UNA vez, al montar, así
 * que el elemento con `role="dialog"` tiene que aparecer y desaparecer del DOM
 * con el aviso. Con un solo componente que devolviera `null`, el hook correría
 * antes de que existiera nada que enfocar.
 */
export function SessionExpiryDialog({
  secondsLeft,
  cause,
  onStay,
  onLeave,
}: SessionExpiryDialogProps) {
  if (secondsLeft === null || cause === null) return null;
  return <ExpiryPrompt secondsLeft={secondsLeft} cause={cause} onStay={onStay} onLeave={onLeave} />;
}

interface PromptProps {
  secondsLeft: number;
  cause: 'idle' | 'absolute';
  onStay: () => void;
  onLeave: () => void;
}

/**
 * Los dos motivos se explican distinto a propósito. Por inactividad, seguir
 * aquí ES la solución y el botón la ofrece. Por antigüedad de la sesión no hay
 * nada que pulsar: a las doce horas toca volver a autenticarse aunque se esté
 * trabajando, y prometer un «seguir aquí» que no va a funcionar sería peor que
 * no ofrecerlo.
 */
function ExpiryPrompt({ secondsLeft, cause, onStay, onLeave }: PromptProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  /*
   * Escape equivale a «seguir trabajando», no a cerrar sesión.
   *
   * Un diálogo modal debe poder cerrarse con teclado, pero la salida por
   * omisión no puede ser la destructiva: quien pulsa Escape por reflejo estaría
   * tirando su propia sesión. Por antigüedad tampoco hace daño —el cierre llega
   * igual cuando vence el plazo—.
   */
  useDialogFocus(dialog, primary, onStay);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdown = minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog session-expiry"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expiry-title"
        aria-describedby="session-expiry-body"
        ref={dialog}
      >
        <h2 id="session-expiry-title">
          <ShieldAlert size={18} aria-hidden="true" />
          {cause === 'idle' ? 'Tu sesión va a cerrarse' : 'Hay que volver a autenticarse'}
        </h2>
        <p id="session-expiry-body">
          {cause === 'idle'
            ? 'No ha habido actividad en los últimos 30 minutos. Por seguridad el portal cerrará la sesión, y se perderá lo que no esté guardado.'
            : 'Esta sesión lleva 12 horas abierta, que es el máximo permitido. Guarda lo que tengas a medias antes de continuar.'}
        </p>
        {/*
          `aria-live="off"` con `role="timer"`: la cuenta se consulta, no se
          anuncia. Un `polite` aquí interrumpiría la lectura del propio aviso
          ciento veinte veces seguidas.
        */}
        <p className="session-expiry-countdown" role="timer" aria-live="off">
          Se cierra en <strong>{countdown}</strong>
        </p>
        <div className="dialog-actions">
          <button className="button" type="button" onClick={onLeave}>
            Cerrar sesión ahora
          </button>
          {cause === 'idle' ? (
            <button className="button button-primary" type="button" ref={primary} onClick={onStay}>
              Seguir trabajando
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
