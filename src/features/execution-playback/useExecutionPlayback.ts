'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePageVisible } from '../../hooks/useMotionPreferences';
import { stepInterval, type PlaybackSpeedId } from '../../styles/motion-tokens';

export interface PlaybackState {
  cursor: number;
  playing: boolean;
  speed: PlaybackSpeedId;
  atStart: boolean;
  atEnd: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  restart: () => void;
  goTo: (index: number) => void;
  setSpeed: (speed: PlaybackSpeedId) => void;
}

/**
 * Máquina de reproducción de una ejecución.
 *
 * Avanza sobre pasos ya ocurridos: no ejecuta nada, sólo mueve un cursor por la
 * traza que el backend ya entregó. Se detiene sola al llegar al último paso, en
 * la velocidad "paso a paso" no avanza jamás por su cuenta y se pausa cuando la
 * pestaña deja de estar visible, para no consumir temporizadores en segundo
 * plano ni "adelantar" la reproducción mientras nadie la mira.
 */
export function useExecutionPlayback(total: number): PlaybackState {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeedId>('normal');
  const visible = usePageVisible();
  const last = Math.max(0, total - 1);

  // Un cambio de ejecución (o de longitud de la traza) devuelve el cursor al
  // principio: mantenerlo apuntaría a un paso de la ejecución anterior.
  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [total]);

  useEffect(() => {
    if (!playing || !visible || total <= 1) return;
    const interval = stepInterval(speed);
    if (interval <= 0) return;
    const timer = window.setInterval(() => {
      setCursor((current) => {
        if (current >= last) {
          setPlaying(false);
          return last;
        }
        return current + 1;
      });
    }, interval);
    return () => window.clearInterval(timer);
  }, [last, playing, speed, total, visible]);

  const goTo = useCallback(
    (index: number) => {
      setCursor(Math.min(Math.max(0, index), last));
    },
    [last],
  );

  const play = useCallback(() => {
    if (total <= 1) return;
    // Pulsar reproducir al final reinicia: es lo que espera quien acaba de ver
    // el recorrido y quiere volver a verlo.
    setCursor((current) => (current >= last ? 0 : current));
    setPlaying(true);
  }, [last, total]);

  return useMemo(
    () => ({
      cursor,
      playing,
      speed,
      atStart: cursor === 0,
      atEnd: cursor >= last,
      play,
      pause: () => setPlaying(false),
      toggle: () => (playing ? setPlaying(false) : play()),
      next: () => {
        setPlaying(false);
        goTo(cursor + 1);
      },
      previous: () => {
        setPlaying(false);
        goTo(cursor - 1);
      },
      restart: () => {
        setPlaying(false);
        setCursor(0);
      },
      goTo: (index: number) => {
        setPlaying(false);
        goTo(index);
      },
      setSpeed: (next: PlaybackSpeedId) => {
        setSpeed(next);
        if (next === 'step') setPlaying(false);
      },
    }),
    [cursor, goTo, last, play, playing, speed],
  );
}
