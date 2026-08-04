'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { errorTutorial, tutorialById } from './interactive-catalog';
import {
  InteractiveTutorialContext,
  type InteractiveTutorialValue,
  type StartOptions,
} from './InteractiveTutorialContext';
import { InteractiveTutorialOverlay } from './InteractiveTutorialOverlay';
import type { InteractiveTutorial } from './interactive-types';
import {
  applicableIndex,
  clampStep,
  routeForStep,
  type TutorialRouter,
} from './tutorial-navigation';
import { tutorialMeta } from './tutorial-registry';
import { useTutorialProgress } from './useTutorialProgress';

/**
 * Ruta en la que debe verse el paso: la que declara el propio paso y, si el
 * recorrido no habla de rutas, la de su ficha en el Centro. Gracias a esa
 * segunda fuente, los recorridos de pantalla escritos antes de que existiera la
 * navegación entre vistas se pueden lanzar desde el Centro sin reescribirlos.
 */
function tutorialRoute(tutorial: InteractiveTutorial, index: number): string | null {
  return routeForStep(tutorial, index) ?? tutorialMeta(tutorial.id)?.route ?? null;
}

interface Props extends PropsWithChildren {
  /**
   * Navegación real de la aplicación. Se inyecta desde el armazón para que el
   * motor no dependa del router: sin ella los recorridos siguen funcionando,
   * pero no cambian de pantalla solos.
   */
  router?: TutorialRouter;
}

export function InteractiveTutorialProvider({ children, router }: Props) {
  const [tutorial, setTutorial] = useState<InteractiveTutorial | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const { markStarted, saveStep, markCompleted, markSkipped, restart, lastStep } =
    useTutorialProgress();

  // El router cambia de identidad en cada navegación; leerlo por referencia evita
  // que los callbacks se rehagan (y que el efecto de navegación se redispare).
  const routerRef = useRef(router);
  routerRef.current = router;

  const begin = useCallback(
    (found: InteractiveTutorial, from: number, repeat: boolean) => {
      const pathname = routerRef.current?.pathname;
      /**
       * Saltar pasos opcionales exige poder MIRAR la pantalla del recorrido. Al
       * lanzarlo desde el Centro todavía estamos en `/tutorials`, así que el DOM
       * no dice nada sobre los elementos de la vista destino: juzgar ahí
       * descartaría justo los pasos que el usuario venía a ver. Sólo se filtra
       * cuando ya estamos donde el tutorial ocurre.
       */
      const destination = tutorialRoute(found, from);
      const onDestination = destination === null || destination === pathname;
      const first = onDestination ? applicableIndex(found, from, 1, pathname) : from;
      // Si desde el paso pedido no queda nada aplicable, se reintenta desde el
      // principio antes de rendirse: reanudar no puede dejar sin recorrido.
      const index = first === -1 ? applicableIndex(found, 0, 1, pathname) : first;
      if (index === -1) return;
      setTutorial(found);
      setStepIndex(index);
      void (repeat
        ? restart(found.id, found.version)
        : markStarted(found.id, index, found.version));
    },
    [markStarted, restart],
  );

  const start = useCallback(
    (id: string, options?: StartOptions) => {
      const found = tutorialById(id);
      if (!found) return;
      const from = options?.resume ? clampStep(found, lastStep(id)) : 0;
      begin(found, from, Boolean(options?.repeat));
    },
    [begin, lastStep],
  );

  const startForError = useCallback(
    (code: string) => {
      const link = errorTutorial(code);
      if (!link) return false;
      start(link.tutorialId);
      return true;
    },
    [start],
  );

  const finish = useCallback(() => {
    if (tutorial) void markCompleted(tutorial.id, tutorial.version);
    setTutorial(null);
    setStepIndex(0);
  }, [tutorial, markCompleted]);

  /** Salir a medias NO es completar: se guarda el paso para poder retomarlo. */
  const exit = useCallback(() => {
    if (tutorial) void markSkipped(tutorial.id, stepIndex);
    setTutorial(null);
    setStepIndex(0);
  }, [tutorial, stepIndex, markSkipped]);

  const next = useCallback(() => {
    if (!tutorial) return;
    const target = applicableIndex(tutorial, stepIndex + 1, 1, routerRef.current?.pathname);
    if (target === -1) {
      finish();
      return;
    }
    setStepIndex(target);
    void saveStep(tutorial.id, target, tutorial.version);
  }, [tutorial, stepIndex, finish, saveStep]);

  const previous = useCallback(() => {
    if (!tutorial) return;
    const target = applicableIndex(tutorial, stepIndex - 1, -1, routerRef.current?.pathname);
    if (target !== -1) setStepIndex(target);
  }, [tutorial, stepIndex]);

  /**
   * Lleva al usuario a la pantalla del paso actual.
   *
   * Sin esto, un recorrido que cruza vistas resaltaría el vacío: el elemento no
   * está porque la pantalla no es la correcta, no porque falte. Se compara con la
   * ruta actual para no empujar una navegación redundante en cada paso.
   */
  useEffect(() => {
    if (!tutorial) return;
    const route = tutorialRoute(tutorial, stepIndex);
    const nav = routerRef.current;
    if (!route || !nav || nav.pathname === route) return;
    nav.push(route);
  }, [tutorial, stepIndex, router]);

  const value: InteractiveTutorialValue = useMemo(
    () => ({ tutorial, stepIndex, start, startForError, next, previous, exit }),
    [tutorial, stepIndex, start, startForError, next, previous, exit],
  );

  return (
    <InteractiveTutorialContext.Provider value={value}>
      {children}
      {tutorial ? (
        <InteractiveTutorialOverlay
          tutorial={tutorial}
          stepIndex={stepIndex}
          onNext={next}
          onPrevious={previous}
          onExit={exit}
        />
      ) : null}
    </InteractiveTutorialContext.Provider>
  );
}
