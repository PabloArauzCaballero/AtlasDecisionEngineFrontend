'use client';

import { GraduationCap, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useInteractiveTutorial } from './useInteractiveTutorial';
import { useTutorialProgress } from './useTutorialProgress';

/** Recorrido que se ofrece a quien nunca ha usado el portal. */
const WELCOME = 'welcome';

interface Props {
  /** Sólo se ofrece en la pantalla de entrada, no encima de cualquier trabajo. */
  active: boolean;
}

/**
 * Invitación al recorrido introductorio, la primera vez.
 *
 * `autoShow` se guardaba desde el principio pero no disparaba nada: la promesa
 * del §6 —"opción de no volver a mostrar un tutorial introductorio"— no tenía
 * dónde ejercerse porque el tutorial nunca se ofrecía solo.
 *
 * Deliberadamente NO arranca el recorrido por su cuenta. Secuestrar la pantalla
 * de alguien que venía a trabajar es la forma más rápida de que aprenda a
 * cerrar la ayuda sin leerla. Se ofrece, con las tres salidas que la persona
 * puede querer: hacerlo, dejarlo para luego, o no volver a verlo.
 */
export function TutorialWelcomePrompt({ active }: Props) {
  const { progress, setAutoShow } = useTutorialProgress();
  const { start, tutorial } = useInteractiveTutorial();
  const [dismissed, setDismissed] = useState(false);

  const entry = progress[WELCOME];
  // Se ofrece sólo si nunca se tocó, o si se dejó a medias sin pedir silencio.
  const pending = !entry || (entry.status !== 'COMPLETED' && entry.autoShow !== false);

  // Un recorrido en marcha manda: la invitación no puede taparlo.
  useEffect(() => {
    if (tutorial) setDismissed(true);
  }, [tutorial]);

  if (!active || !pending || dismissed) return null;

  return (
    <aside className="tutorial-welcome" role="complementary" aria-label="Recorrido de bienvenida">
      <GraduationCap size={20} aria-hidden />
      <div className="tutorial-welcome-text">
        <strong>¿Primera vez por aquí?</strong>
        <span>
          Un recorrido de tres minutos por la interfaz real: qué gobierna este portal y por dónde
          empezar.
        </span>
      </div>
      <div className="tutorial-welcome-actions">
        <button
          className="button button-primary"
          type="button"
          onClick={() => start(WELCOME, { resume: true })}
        >
          Hacer el recorrido
        </button>
        <button className="button" type="button" onClick={() => setDismissed(true)}>
          Ahora no
        </button>
        <button
          className="tutorial-welcome-never"
          type="button"
          onClick={() => {
            void setAutoShow(WELCOME, false);
            setDismissed(true);
          }}
        >
          No volver a mostrar
        </button>
      </div>
      <button
        className="icon-button tutorial-welcome-close"
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Cerrar la invitación"
      >
        <X size={16} />
      </button>
    </aside>
  );
}
