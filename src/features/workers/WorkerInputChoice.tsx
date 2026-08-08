'use client';

import type { ReactNode } from 'react';
import type { WorkerFixture } from './worker-types';

interface WorkerInputChoiceProps {
  mode: 'fixture' | 'own';
  onModeChange: (mode: 'fixture' | 'own') => void;
  fixturesEnabled: boolean;
  fixtures: WorkerFixture[];
  selectedFixture: string;
  onFixtureChange: (code: string) => void;
  /** Texto de la segunda opción: cambia según el worker. */
  ownLabel: string;
  disabled?: boolean;
  /** El control propio de cada worker: un área de texto o un selector de archivo. */
  children: ReactNode;
}

/**
 * Elección entre datos de prueba y datos propios.
 *
 * Un grupo de radios, no pestañas: son dos opciones excluyentes de un
 * formulario, y los radios ya traen del navegador la navegación con flechas, el
 * anuncio del grupo y la relación con su etiqueta. Reconstruir eso con botones
 * significa reimplementar el teclado a mano, y casi siempre a medias.
 */
export function WorkerInputChoice({
  mode,
  onModeChange,
  fixturesEnabled,
  fixtures,
  selectedFixture,
  onFixtureChange,
  ownLabel,
  disabled = false,
  children,
}: WorkerInputChoiceProps) {
  const chosen = fixtures.find((fixture) => fixture.code === selectedFixture);

  return (
    <div className="worker-input">
      {/*
       * Las dos opciones se pintan como tarjetas seleccionables, pero por
       * dentro siguen siendo radios de verdad: el área pulsable crece y la
       * elegida se ve sin tener que buscar un punto de 12 px, sin renunciar a
       * las flechas del teclado ni al anuncio del grupo que trae el navegador.
       */}
      <fieldset className="worker-mode" disabled={disabled}>
        <legend className="field-label">Origen de los datos</legend>
        <div className="worker-mode-options">
          <label
            className={`worker-mode-option${mode === 'fixture' ? ' is-selected' : ''}${
              fixturesEnabled ? '' : ' is-unavailable'
            }`}
          >
            <input
              type="radio"
              name="worker-input-mode"
              value="fixture"
              checked={mode === 'fixture'}
              onChange={() => onModeChange('fixture')}
              disabled={!fixturesEnabled}
            />
            <span>
              Usar datos de prueba
              {!fixturesEnabled ? (
                <small className="field-help">
                  Deshabilitados en este entorno para que no contaminen la operación.
                </small>
              ) : (
                /*
                 * «Casos» y no «escenarios»: la palabra ya nombra al selector de
                 * abajo, y repetirla aquí hacía que el nombre accesible de este
                 * radio contuviera «Escenario», de modo que buscar el selector
                 * por su etiqueta encontraba los dos controles.
                 */
                <small className="field-help">
                  Casos sintéticos del motor, sin datos personales.
                </small>
              )}
            </span>
          </label>
          <label className={`worker-mode-option${mode === 'own' ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="worker-input-mode"
              value="own"
              checked={mode === 'own'}
              onChange={() => onModeChange('own')}
            />
            <span>
              {ownLabel}
              <small className="field-help">Lo que quieras procesar de verdad.</small>
            </span>
          </label>
        </div>
      </fieldset>

      {mode === 'fixture' ? (
        <div className="worker-fixtures">
          <label className="field">
            <span className="field-label">Escenario</span>
            <select
              value={selectedFixture}
              onChange={(event) => onFixtureChange(event.target.value)}
              disabled={disabled || !fixturesEnabled}
            >
              <option value="">Elige un escenario…</option>
              {fixtures.map((fixture) => (
                <option key={fixture.code} value={fixture.code}>
                  {fixture.name}
                  {fixture.expectsFailure ? ' — termina en error, a propósito' : ''}
                </option>
              ))}
            </select>
          </label>

          {chosen ? (
            <div className="worker-fixture-detail">
              <p className="worker-fixture-description">{chosen.description}</p>
              <div className="worker-fixture-preview">
                <span className="field-label">Vista previa</span>
                <pre>{chosen.preview}</pre>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
