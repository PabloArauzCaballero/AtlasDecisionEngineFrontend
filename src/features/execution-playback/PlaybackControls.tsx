import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { playbackSpeeds } from '../../styles/motion-tokens';
import { Tooltip } from '../../components/Tooltip';
import type { PlaybackState } from './useExecutionPlayback';

interface PlaybackControlsProps {
  playback: PlaybackState;
  total: number;
  /** Nombre del paso actual, para anunciarlo por `aria-live`. */
  currentLabel: string;
}

/**
 * Controles de la reproducción. Cada botón es de icono + tooltip + `aria-label`
 * y mide 36 px, por encima del mínimo cómodo de pulsación en táctil.
 *
 * El paso actual se anuncia por `aria-live="polite"`: quien navega con lector de
 * pantalla recibe el mismo recorrido que quien lo ve animarse.
 */
export function PlaybackControls({ playback, total, currentLabel }: PlaybackControlsProps) {
  const { playing, cursor, atStart, atEnd, speed } = playback;

  return (
    <div className="playback-controls">
      <div className="playback-buttons" role="group" aria-label="Controles de reproducción">
        <Tooltip content="Volver al primer paso">
          <button
            type="button"
            className="icon-button"
            onClick={playback.restart}
            disabled={atStart && !playing}
            aria-label="Reiniciar la reproducción"
          >
            <RotateCcw size={17} />
          </button>
        </Tooltip>
        <Tooltip content="Retroceder un paso">
          <button
            type="button"
            className="icon-button"
            onClick={playback.previous}
            disabled={atStart}
            aria-label="Paso anterior"
          >
            <ChevronLeft size={18} />
          </button>
        </Tooltip>
        <Tooltip content={playing ? 'Pausar el recorrido' : 'Reproducir el recorrido paso a paso'}>
          <button
            type="button"
            className="button button-primary playback-play"
            onClick={playback.toggle}
            disabled={total <= 1}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
            <span>{playing ? 'Pausar' : 'Reproducir'}</span>
          </button>
        </Tooltip>
        <Tooltip content="Avanzar un paso">
          <button
            type="button"
            className="icon-button"
            onClick={playback.next}
            disabled={atEnd}
            aria-label="Paso siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </Tooltip>
      </div>

      <div className="playback-speed">
        <span id="playback-speed-label">Velocidad</span>
        <div role="group" aria-labelledby="playback-speed-label">
          {playbackSpeeds.map((option) => (
            <button
              key={option.id}
              type="button"
              className={speed === option.id ? 'speed-option active' : 'speed-option'}
              aria-pressed={speed === option.id}
              onClick={() => playback.setSpeed(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="playback-position" aria-live="polite">
        <strong>{`Paso ${Math.min(cursor + 1, total)} de ${total}`}</strong> · {currentLabel}
      </p>
    </div>
  );
}
