'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Infers a typed value from free text: boolean, number, JSON, or plain string. */
function coerce(raw: string): unknown {
  const text = raw.trim();
  if (text === '') return '';
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text);
    } catch {
      return raw;
    }
  }
  return raw;
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Third input mode for the simulator: an editable attribute→value table. Add a pair
 * ("crear atributo"), rename its key, set its value (typed automatically) or remove
 * it. Works on the same JSON payload, so it's ideal for fields OUTSIDE the contract
 * without writing JSON by hand.
 */
export function PairsEditor({
  parsed,
  onCommit,
}: {
  parsed: Record<string, unknown>;
  onCommit: (next: Record<string, unknown>) => void;
}) {
  const entries = Object.entries(parsed);

  function rename(oldKey: string, rawKey: string) {
    const newKey = rawKey.trim();
    if (!newKey || newKey === oldKey || newKey in parsed) return;
    const next: Record<string, unknown> = {};
    for (const [key, value] of entries) next[key === oldKey ? newKey : key] = value;
    onCommit(next);
  }
  function add() {
    let key = 'nuevo_atributo';
    let index = 1;
    while (key in parsed) key = `nuevo_atributo_${index++}`;
    onCommit({ ...parsed, [key]: '' });
  }

  return (
    <div className="pairs-editor">
      {!entries.length ? (
        <small className="field-meta">Aún no hay valores. Añade el primer atributo.</small>
      ) : null}
      {entries.map(([key, value]) => (
        <PairRow
          key={key}
          pairKey={key}
          value={value}
          onRename={(next) => rename(key, next)}
          onValue={(next) => onCommit({ ...parsed, [key]: next })}
          onRemove={() => {
            const next = { ...parsed };
            delete next[key];
            onCommit(next);
          }}
        />
      ))}
      <button type="button" className="button pair-add" onClick={add}>
        <Plus size={14} /> Añadir atributo
      </button>
    </div>
  );
}

/**
 * Una fila del editor, con el texto que se ve SIEMPRE atado al valor real.
 *
 * Las dos cajas eran `defaultValue`, es decir, no controladas: el navegador se
 * quedaba con lo escrito y React sólo lo fijaba al montar. Bastaba con que el
 * payload cambiara desde fuera —subir un PDF, generar valores, elegir otro caso
 * de la tanda— para que la fila siguiera enseñando lo anterior mientras el JSON
 * que se enviaba ya decía otra cosa. Ése era el «ya están todas llenas» con el
 * motor contestando `Required variable … is missing`: la pantalla enseñaba un
 * valor que no existía en la petición.
 *
 * El valor se confirma **al teclear** y no al salir del campo, por lo mismo:
 * pulsar «Ejecutar» sin salir antes de la caja enviaba lo de antes.
 */
function PairRow({
  pairKey,
  value,
  onRename,
  onValue,
  onRemove,
}: {
  pairKey: string;
  value: unknown;
  onRename: (next: string) => void;
  onValue: (next: unknown) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(() => valueText(value));
  const [keyText, setKeyText] = useState(pairKey);

  // Sincroniza con lo que llega de fuera. Sin esto volvería el defecto que este
  // componente arregla, sólo que con una caja controlada.
  useEffect(() => setText(valueText(value)), [value]);
  useEffect(() => setKeyText(pairKey), [pairKey]);

  return (
    <div className="pair-row">
      <input
        className="pair-key"
        value={keyText}
        aria-label="Atributo"
        onChange={(event) => setKeyText(event.target.value)}
        // El nombre se confirma al salir del campo: renombrar en cada tecla
        // partiría la clave en `n`, `nu`, `nue`… y cada una crearía una entrada.
        onBlur={(event) => onRename(event.target.value)}
      />
      <span className="pair-eq">=</span>
      <input
        className="pair-value"
        value={text}
        aria-label={`Valor de ${pairKey}`}
        onChange={(event) => {
          setText(event.target.value);
          onValue(coerce(event.target.value));
        }}
      />
      <button
        type="button"
        className="icon-button"
        aria-label={`Quitar ${pairKey}`}
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
