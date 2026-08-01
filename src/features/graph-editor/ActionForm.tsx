'use client';

import { useState } from 'react';
import { InfoHint } from '../../components/InfoHint';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { astToText } from './json-ast';

interface Props {
  onCreate: (action: UnknownRecord) => void;
  onCancel: () => void;
  /** Acción existente a editar. Sin ella el formulario da de alta una nueva. */
  initial?: UnknownRecord;
}

type Mode = 'guided' | 'expression';

const TYPES = [
  {
    value: 'SET_FIELD',
    label: 'Calcular y escribir un campo',
    hint: 'Escribe un valor que otros pasos podrán leer.',
  },
  {
    value: 'EMIT_REASON',
    label: 'Emitir un motivo',
    hint: 'Añade un reason code explicable al resultado.',
  },
  {
    value: 'CREATE_MANUAL_REVIEW',
    label: 'Abrir revisión manual',
    hint: 'Deriva el caso a una persona en lugar de resolverlo.',
  },
] as const;

/**
 * Alta de una acción, en dos modos.
 *
 * **Guiado** cubre lo que se necesita el 90 % de las veces sin conocer el
 * formato interno: tipo, campo destino y valor. **Expresión** deja escribir
 * directamente el árbol JSON que evalúa el motor, con vista previa en lenguaje
 * natural para comprobar que dice lo que uno cree.
 *
 * No hay un modo "pegar Python/JavaScript" aquí a propósito: traducir código a
 * decisiones es exactamente lo que hace *Importar código*, que lo compila en el
 * backend y genera el grafo entero. Duplicarlo aquí con un traductor propio del
 * navegador daría resultados distintos a los del motor, que es peor que no
 * tenerlo.
 */
export function ActionForm({ onCreate, onCancel, initial }: Props) {
  const editing = Boolean(initial);
  const seed = asRecord(initial?.payload);
  // Al editar se abre en modo expresión: las acciones que ya existen suelen
  // traer un árbol que el modo guiado no puede representar sin perder detalle.
  const [mode, setMode] = useState<Mode>(seed.valueExpression ? 'expression' : 'guided');
  const [code, setCode] = useState(initial ? display(initial, 'code') : '');
  const [type, setType] = useState<string>(initial ? display(initial, 'type') : 'SET_FIELD');
  const [field, setField] = useState(
    seed.field !== undefined ? String(seed.field) : String(seed.queueCode ?? ''),
  );
  const [variable, setVariable] = useState('');
  const [value, setValue] = useState('');
  const [reasonCode, setReasonCode] = useState(
    asRows(initial?.reasonCodes)[0] ? display(asRows(initial?.reasonCodes)[0], 'code') : '',
  );
  const [expression, setExpression] = useState(
    seed.valueExpression
      ? JSON.stringify(seed.valueExpression, null, 2)
      : '{\n  "var": "score_buro"\n}',
  );
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');

  /** Valor guiado: una variable, o un literal si no se eligió variable. */
  const guidedExpression = () =>
    variable.trim() ? { var: variable.trim() } : { value: parseLiteral(value) };

  const parsedExpression = () => {
    try {
      return JSON.parse(expression) as unknown;
    } catch {
      return null;
    }
  };

  const preview = mode === 'guided' ? astToText(guidedExpression()) : astToText(parsedExpression());

  const submit = () => {
    if (!normalizedCode) {
      setError('La acción necesita un código para poder referenciarla desde un paso.');
      return;
    }
    if (mode === 'expression' && parsedExpression() === null) {
      setError('La expresión no es JSON válido, así que no se puede guardar.');
      return;
    }
    const valueExpression = mode === 'guided' ? guidedExpression() : parsedExpression();
    const payload: UnknownRecord =
      type === 'SET_FIELD'
        ? { field: field.trim(), valueExpression }
        : type === 'CREATE_MANUAL_REVIEW'
          ? { queueCode: field.trim() }
          : {};

    onCreate({
      code: normalizedCode,
      type,
      payload,
      terminal: initial ? Boolean(initial.terminal) : type !== 'SET_FIELD',
      reasonCodes: reasonCode.trim() ? [{ code: reasonCode.trim().toUpperCase() }] : [],
    });
  };

  return (
    <div className="action-form">
      <div className="action-form-modes" role="group" aria-label="Cómo definir la acción">
        <button
          type="button"
          className={mode === 'guided' ? 'active' : ''}
          onClick={() => setMode('guided')}
        >
          Guiado
        </button>
        <button
          type="button"
          className={mode === 'expression' ? 'active' : ''}
          onClick={() => setMode('expression')}
        >
          Expresión avanzada
        </button>
      </div>

      <div className="form-row">
        <label className="field">
          <span>Código de la acción</span>
          <input
            value={code}
            placeholder="SET_SCORE_RIESGO"
            onChange={(event) => setCode(event.target.value)}
          />
          <small className="field-hint">
            Se normaliza a MAYÚSCULAS con guiones bajos: {normalizedCode || '—'}
          </small>
        </label>
        <label className="field">
          <span>Qué hace</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <small className="field-hint">{TYPES.find((entry) => entry.value === type)?.hint}</small>
        </label>
      </div>

      {type !== 'EMIT_REASON' ? (
        <label className="field">
          <span>{type === 'SET_FIELD' ? 'Campo que escribe' : 'Cola de revisión'}</span>
          <input
            value={field}
            placeholder={type === 'SET_FIELD' ? 'score_riesgo' : 'FRAUDE_N2'}
            onChange={(event) => setField(event.target.value)}
          />
        </label>
      ) : null}

      {type === 'SET_FIELD' && mode === 'guided' ? (
        <div className="form-row">
          <label className="field">
            <span>
              Valor desde una variable
              <InfoHint text="Escribe el código de la variable cuyo valor se copiará. Deja este campo vacío si quieres fijar un valor literal." />
            </span>
            <input
              value={variable}
              placeholder="score_buro"
              onChange={(event) => setVariable(event.target.value)}
            />
          </label>
          <label className="field">
            <span>o valor fijo</span>
            <input
              value={value}
              placeholder="APROBADO, 100, true…"
              disabled={Boolean(variable.trim())}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        </div>
      ) : null}

      {type === 'SET_FIELD' && mode === 'expression' ? (
        <label className="field">
          <span>
            Expresión (JSON)
            <InfoHint text="El árbol que evalúa el motor: {op, left, right}, {var}, {value}. La vista previa de abajo lo traduce a lenguaje natural." />
          </span>
          <textarea
            className="code-input"
            rows={7}
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
          />
        </label>
      ) : null}

      {type === 'EMIT_REASON' ? (
        <label className="field">
          <span>Reason code que emite</span>
          <input
            value={reasonCode}
            placeholder="DOC_MISSING"
            onChange={(event) => setReasonCode(event.target.value)}
          />
        </label>
      ) : null}

      {type === 'SET_FIELD' ? (
        <p className="action-preview">
          <b>Quedará como:</b> {field.trim() || 'campo'} = {preview || '…'}
        </p>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}

      <div className="action-form-actions">
        <button className="button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button button-primary" type="button" onClick={submit}>
          {editing ? 'Guardar cambios' : 'Crear acción'}
        </button>
      </div>
    </div>
  );
}

/** Convierte el literal escrito por el usuario al tipo que representa. */
function parseLiteral(raw: string): unknown {
  const text = raw.trim();
  if (text === '') return '';
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}
