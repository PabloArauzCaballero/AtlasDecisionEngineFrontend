'use client';

import { Plus, Trash2 } from 'lucide-react';

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
        <div className="pair-row" key={key}>
          <input
            className="pair-key"
            defaultValue={key}
            aria-label="Atributo"
            onBlur={(event) => rename(key, event.target.value)}
          />
          <span className="pair-eq">=</span>
          <input
            className="pair-value"
            defaultValue={valueText(value)}
            aria-label={`Valor de ${key}`}
            onBlur={(event) => onCommit({ ...parsed, [key]: coerce(event.target.value) })}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={`Quitar ${key}`}
            onClick={() => {
              const next = { ...parsed };
              delete next[key];
              onCommit(next);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="button pair-add" onClick={add}>
        <Plus size={14} /> Añadir atributo
      </button>
    </div>
  );
}
