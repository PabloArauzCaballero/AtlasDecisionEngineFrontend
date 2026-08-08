'use client';

import { useMemo, useState } from 'react';
import { Alert } from '../components/Alert';
import { JsonTextarea } from '../components/JsonTextarea';
import { FieldControl } from '../features/simulator/SimulatorFieldControl';
import { PairsEditor } from '../features/simulator/SimulatorPairsEditor';
import { useVersionInputContract } from './useVersionInputContract';

type View = 'form' | 'pairs' | 'json';

interface Props {
  /** Versión que prueba la suite: de ahí sale el contrato, no del catálogo. */
  artifactVersionId?: string;
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}

/**
 * La entrada de un caso de prueba, en las tres formas de escribirla.
 *
 * Antes sólo había JSON. Escribir a mano un objeto que cumpla el contrato de la
 * versión obliga a ir consultando el catálogo campo por campo, y un nombre mal
 * escrito no se ve hasta el 422 al guardar — con el agravante de que un caso de
 * prueba con una variable inexistente no falla: se ignora, y la prueba pasa sin
 * probar nada.
 *
 * Es el mismo trío que el simulador (formulario, atributo-valor, JSON) porque es
 * la misma tarea: rellenar el contrato de entrada de un algoritmo. Lo que cambia
 * es de dónde sale el contrato —aquí, de la versión que la suite prueba—.
 */
export function CaseInputEditor({ artifactVersionId, id, label, value, onChange }: Props) {
  const [view, setView] = useState<View>('form');
  const contract = useVersionInputContract(artifactVersionId);

  const parsed = useMemo<Record<string, unknown> | null>(() => {
    try {
      const object: unknown = JSON.parse(value);
      return object && typeof object === 'object' && !Array.isArray(object)
        ? (object as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }, [value]);

  const setField = (code: string, next: unknown) => {
    if (!parsed) return;
    const draft = { ...parsed };
    if (next === undefined) delete draft[code];
    else draft[code] = next;
    onChange(JSON.stringify(draft, null, 2));
  };

  const missing = contract.inputs
    .filter((input) => input.required)
    .map((input) => input.code)
    .filter((code) => parsed === null || parsed[code] === undefined || parsed[code] === '');

  const known = new Set(contract.inputs.map((input) => input.code));
  const extras = parsed ? Object.keys(parsed).filter((key) => !known.has(key)) : [];

  return (
    // `data-editor` identifica CUÁL de los dos editores es —la entrada o el
    // resultado esperado— sin depender de su texto visible, que cambia.
    <div className="case-input-editor" data-editor={id}>
      <div className="view-tabs" role="tablist" aria-label={`Modo de edición · ${label}`}>
        {(
          [
            ['form', 'Formulario'],
            ['pairs', 'Atributo-valor'],
            ['json', 'JSON'],
          ] as const
        ).map(([mode, text]) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={view === mode}
            onClick={() => setView(mode)}
          >
            {text}
          </button>
        ))}
      </div>

      {parsed === null && view !== 'json' ? (
        <Alert tone="error">
          El JSON actual es inválido: corrígelo en la vista JSON antes de usar esta forma.
        </Alert>
      ) : null}

      {view === 'json' ? (
        <JsonTextarea id={id} label={label} value={value} onChange={onChange} rows={12} />
      ) : view === 'pairs' && parsed !== null ? (
        <PairsEditor parsed={parsed} onCommit={(next) => onChange(JSON.stringify(next, null, 2))} />
      ) : view === 'form' && parsed !== null ? (
        <div className="simulator-variable-form">
          {!artifactVersionId ? (
            <Alert tone="info">
              Sin versión asignada no se puede leer el contrato: usa la vista JSON.
            </Alert>
          ) : null}
          {contract.isError ? (
            <Alert tone="warning">
              No se pudo leer el contrato de la versión. La vista JSON sigue disponible.
            </Alert>
          ) : null}
          {contract.isEmpty ? (
            <Alert tone="info">Esta versión no declara variables de entrada.</Alert>
          ) : null}
          {/*
           * Lo que falta se dice ANTES de guardar. Un caso al que le falta una
           * variable obligatoria no prueba el algoritmo: prueba que el motor
           * rechaza una entrada incompleta, que es otra cosa.
           */}
          {missing.length ? (
            <Alert tone="warning">
              Faltan {missing.length} variable(s) obligatoria(s):{' '}
              <strong>{missing.join(', ')}</strong>.
            </Alert>
          ) : null}
          {contract.inputs.map((input) => {
            const current = parsed[input.code];
            return (
              <label className="field" key={input.code}>
                <span>
                  {input.code}
                  {input.required ? ' *' : ''}
                </span>
                {input.allowed.length ? (
                  <select
                    value={current === undefined || current === null ? '' : String(current)}
                    onChange={(event) =>
                      setField(
                        input.code,
                        event.target.value === '' ? undefined : event.target.value,
                      )
                    }
                  >
                    <option value="">Sin valor</option>
                    {input.allowed.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <FieldControl
                    dataType={input.dataType}
                    value={current}
                    onCommit={(next) => setField(input.code, next)}
                  />
                )}
                <small className="field-meta">
                  {input.dataType}
                  {input.displayName !== input.code ? ` · ${input.displayName}` : ''}
                  {/* Un caso de prueba se versiona y lo lee todo el equipo: un
                      dato personal real dentro es una fuga guardada. */}
                  {input.sensitive ? ' · dato sensible: usa un valor ficticio' : ''}
                </small>
              </label>
            );
          })}
          {extras.length ? (
            <small className="field-meta">
              Campos fuera del contrato de esta versión (el motor los ignorará): {extras.join(', ')}
            </small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
