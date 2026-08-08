'use client';

import { ArrowLeft, ArrowRight, MousePointerClick, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InteractiveTutorial, RequiredAction } from './interactive-types';
import { usePlacement, useTargetDisabled } from './overlay-hooks';
import { useTutorialTarget } from './useTutorialTarget';

const PAD = 8;

/** Qué se le pide al usuario mientras el paso espera su acción. */
const WAIT_LABEL: Record<RequiredAction, string> = {
  click: 'Haz clic en lo resaltado para seguir…',
  input: 'Escribe o elige un valor en lo resaltado para seguir…',
  submit: 'Envía el formulario resaltado para seguir…',
};

interface Props {
  tutorial: InteractiveTutorial;
  stepIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onExit: () => void;
}

/**
 * Overlay interactivo: oscurece la pantalla, resalta el elemento del paso actual
 * y muestra una tarjeta con la explicación. Cuando el paso pide una acción
 * (`requiredAction`), NO ofrece "Siguiente": escucha la acción real sobre el
 * elemento resaltado y avanza recién cuando el usuario la hace.
 */
export function InteractiveTutorialOverlay({
  tutorial,
  stepIndex,
  onNext,
  onPrevious,
  onExit,
}: Props) {
  const step = tutorial.steps[stepIndex];
  const rect = useTutorialTarget(step.target);
  const [actionDone, setActionDone] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const disabled = useTargetDisabled(step.target, rect);

  /**
   * Salir del primer paso no cuesta nada; salir del séptimo tira el recorrido
   * hecho, así que ahí sí se pregunta. Se confirma DENTRO de la tarjeta y no con
   * `window.confirm`, que ni respeta el tema ni se puede leer con el resto.
   */
  const requestExit = useCallback(() => {
    if (stepIndex === 0) onExit();
    else setConfirmingExit(true);
  }, [stepIndex, onExit]);

  // Cambiar de paso invalida una confirmación abierta: preguntar por una salida
  // que el usuario ya no está pidiendo sería ruido.
  useEffect(() => setConfirmingExit(false), [stepIndex]);

  // Escape cierra el recorrido (además del botón de cerrar): es lo que espera
  // cualquier usuario de un overlay modal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestExit();
      // Mientras se pregunta por la salida, las flechas no deben mover el paso
      // por debajo de la pregunta.
      if (confirmingExit) return;
      // Flechas para recorrer los pasos: es lo que espera cualquiera que haya
      // usado una presentación, y evita tener que apuntar con el ratón.
      if (event.key === 'ArrowRight') onNext();
      if (event.key === 'ArrowLeft') onPrevious();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestExit, onNext, onPrevious, confirmingExit]);

  // El elemento del paso puede estar fuera de la pantalla (una tabla larga, el
  // panel de resultados): se trae a la vista para que el foco sea visible.
  useEffect(() => {
    if (!step.target) return;
    const element = document.querySelector(step.target);
    if (element instanceof HTMLElement && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [step.target]);

  /**
   * `true` en cuanto el elemento del paso existe de verdad en la página.
   *
   * Se usa como disparador para (re)enganchar el escucha de la acción. Es un
   * booleano y no el rect a propósito: el rect cambia con cada scroll, y
   * depender de él reiniciaría el estado del paso continuamente.
   */
  const hasTarget = Boolean(rect);

  useEffect(() => {
    setActionDone(false);
    if (!step.requiredAction || !step.target) return;
    const element = document.querySelector(step.target);
    // Sin elemento no hay a quién escuchar, pero esto NO es el final: cuando
    // aparezca, `hasTarget` cambia y el efecto se vuelve a ejecutar.
    //
    // Antes se enganchaba una sola vez, al mostrar el paso. Un paso que exige
    // una acción sobre algo que llega DESPUÉS —tras navegar a la pantalla, o
    // tras la respuesta del backend— se quedaba sin escucha para siempre: la
    // persona pulsaba lo resaltado y el recorrido no avanzaba nunca.
    if (!element) return;
    const events: Record<RequiredAction, string[]> = {
      click: ['click'],
      // "Escribir" cubre tanto teclear como elegir en un desplegable.
      input: ['input', 'change'],
      submit: ['submit'],
    };
    const handler = () => {
      setActionDone(true);
      onNext();
    };
    const names = events[step.requiredAction];
    for (const name of names) element.addEventListener(name, handler, { once: true });
    return () => {
      for (const name of names) element.removeEventListener(name, handler);
    };
  }, [step, onNext, hasTarget]);

  /**
   * Sólo se espera una acción si hay algo real sobre lo que hacerla.
   *
   * Éste era el bloqueo: un paso con `requiredAction` cuyo elemento no estaba en
   * pantalla —o estaba deshabilitado— ocultaba el botón "Siguiente" y dejaba el
   * recorrido muerto, sin más salida que cerrarlo. Ahora, si no hay elemento
   * accionable, el paso se explica igual y se puede continuar.
   */
  const actionable = Boolean(rect) && !disabled;
  const waitingForAction = Boolean(step.requiredAction) && actionable && !actionDone;
  const waitLabel = WAIT_LABEL[step.requiredAction ?? 'click'];
  const isLast = stepIndex === tutorial.steps.length - 1;
  const placement = usePlacement(card, rect);

  // Sin `aria-modal`: este recorrido pide que se pulse el elemento REAL de la
  // página (`requiredAction`). Declararlo modal le diría al lector de pantalla
  // que todo lo de fuera está inerte justo cuando hay que ir a usarlo, y el
  // tutorial quedaría imposible de seguir sin ratón.
  return (
    <div className="tutorial-overlay" role="dialog" aria-label={step.title}>
      {rect ? (
        <div
          className="tutorial-spotlight"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="tutorial-scrim" />
      )}
      <div
        ref={card}
        className={
          placement
            ? `tutorial-tooltip tutorial-from-${placement.side}`
            : 'tutorial-tooltip tutorial-tooltip-centered'
        }
        style={placement ? { top: placement.top, left: placement.left } : undefined}
      >
        <button
          className="icon-button tutorial-close"
          type="button"
          onClick={requestExit}
          aria-label="Salir del tutorial"
        >
          <X size={16} />
        </button>
        <p className="tutorial-progress">
          {tutorial.title} · paso {stepIndex + 1} de {tutorial.steps.length}
        </p>
        <div
          className="tutorial-progress-bar"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={tutorial.steps.length}
        >
          <span style={{ width: `${((stepIndex + 1) / tutorial.steps.length) * 100}%` }} />
        </div>
        {/* El "para qué sirve" del recorrido sólo estaba en el catálogo y no se
            mostraba nunca: se empezaba un tutorial sin saber a dónde lleva. */}
        {stepIndex === 0 ? <p className="tutorial-intro">{tutorial.intro}</p> : null}
        <h3>{step.title}</h3>
        <p>{step.content}</p>
        {step.tip ? <p className="tutorial-tip">{step.tip}</p> : null}
        {/* Decir dónde mirar es la mitad del tutorial: sin esto, un paso cuyo
            elemento no está en pantalla se lee como si faltara información. */}
        {step.target && !rect ? (
          <p className="tutorial-note">
            Este paso señala algo que ahora mismo no está en pantalla; la explicación vale igual y
            puedes continuar.
          </p>
        ) : null}
        {step.target && disabled ? (
          <p className="tutorial-note">
            El elemento resaltado está deshabilitado en este momento, así que no puedes usarlo
            todavía. Continúa y vuelve cuando esté disponible.
          </p>
        ) : null}
        {confirmingExit ? (
          <div className="tutorial-confirm" role="alertdialog" aria-label="Confirmar salida">
            <p>
              Llevas {stepIndex + 1} de {tutorial.steps.length} completados. Si sales ahora se
              guarda tu avance y puedes retomarlo desde el Centro de Tutoriales.
            </p>
            <div className="tutorial-confirm-actions">
              <button className="button" type="button" onClick={() => setConfirmingExit(false)}>
                Seguir aquí
              </button>
              {/* No repite el nombre del botón de cerrar: dos botones con el
                  mismo nombre accesible dentro del mismo diálogo son
                  indistinguibles para un lector de pantalla. */}
              <button className="button button-danger" type="button" onClick={onExit}>
                Sí, salir
              </button>
            </div>
          </div>
        ) : null}
        <div className="tutorial-actions">
          <button className="button" type="button" onClick={onPrevious} disabled={stepIndex === 0}>
            <ArrowLeft size={14} /> Atrás
          </button>
          {waitingForAction ? (
            <>
              <span className="tutorial-wait">
                <MousePointerClick size={14} /> {waitLabel}
              </span>
              {/* Salida siempre disponible: un recorrido que sólo avanza con un
                  clic concreto no puede ser un callejón sin salida. */}
              <button className="button tutorial-skip" type="button" onClick={onNext}>
                Saltar este paso
              </button>
            </>
          ) : (
            <button className="button button-primary" type="button" onClick={onNext}>
              {isLast ? 'Finalizar' : 'Siguiente'} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
