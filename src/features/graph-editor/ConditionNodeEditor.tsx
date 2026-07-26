import { InfoHint } from '../../components/InfoHint';
import { asRecord, display, type UnknownRecord } from '../../utils/records';

interface ConditionNodeEditorProps {
  condition: UnknownRecord;
  inputs: UnknownRecord[];
  onChange: (patch: UnknownRecord) => void;
  /** Creates a condition bound to this node from the chosen input variable. */
  onCreateCondition?: (variableCode: string) => void;
}

const NUMERIC = new Set(['NUMBER', 'INTEGER', 'INT', 'DECIMAL', 'FLOAT']);

const operators = [
  ['eq', 'Igual a'],
  ['neq', 'Distinto de'],
  ['gt', 'Mayor que'],
  ['gte', 'Mayor o igual'],
  ['lt', 'Menor que'],
  ['lte', 'Menor o igual'],
  ['in', 'Incluido en lista'],
  ['contains', 'Contiene'],
] as const;

export function ConditionNodeEditor({
  condition,
  inputs,
  onChange,
  onCreateCondition,
}: ConditionNodeEditorProps) {
  const expression = asRecord(condition.expression);
  const code = display(condition, 'code');
  const variableCode = String(expression.variable ?? '');
  const operator = String(expression.operator ?? 'gte');
  const selectedType = display(
    inputs.find((input) => display(input, 'code') === variableCode) ?? {},
    'dataType',
  ).toUpperCase();

  function updateExpression(patch: UnknownRecord) {
    onChange({ expression: { ...expression, ...patch } });
  }

  function updateValue(raw: string) {
    try {
      updateExpression({ value: JSON.parse(raw) });
    } catch {
      updateExpression({ value: raw });
    }
  }

  if (!condition.code) {
    return (
      <section className="condition-node-editor">
        <h3>Condición visual</h3>
        <p className="field-hint">
          Elige la <strong>variable de entrada</strong> que quieres evaluar para crear la condición
          de este nodo. El formulario se adaptará al tipo de dato.
        </p>
        <label className="field">
          <span>
            Variable a evaluar
            <InfoHint text="El dato de entrada sobre el que se decide (p. ej. score_buro). Al elegirlo se crea la condición editable." />
          </span>
          <select
            value=""
            onChange={(event) => event.target.value && onCreateCondition?.(event.target.value)}
          >
            <option value="">Elegir variable de entrada…</option>
            {inputs.map((input) => (
              <option key={display(input, 'code')} value={display(input, 'code')}>
                {display(input, 'code')} · {display(input, 'dataType')}
              </option>
            ))}
          </select>
        </label>
        {!inputs.length ? (
          <p className="field-hint">
            Primero declara variables de entrada (panel “Entradas”) para poder condicionar sobre
            ellas.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="condition-node-editor">
      <h3>Condición visual</h3>
      <label className="field">
        <span>Código</span>
        <input readOnly value={code} />
      </label>
      <label className="field">
        <span>Nombre</span>
        <input
          defaultValue={display(condition, 'name')}
          onBlur={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <label className="field">
        <span>
          Variable de entrada
          <InfoHint text="El dato que se compara (p. ej. score_buro). Debe estar declarado como entrada del algoritmo." />
        </span>
        <select
          value={String(expression.variable ?? '')}
          onChange={(event) => updateExpression({ variable: event.target.value })}
        >
          <option value="">Elegir variable…</option>
          {inputs.map((input) => (
            <option key={display(input, 'code')} value={display(input, 'code')}>
              {display(input, 'code')} · {display(input, 'dataType')}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Operador
          <InfoHint text="Cómo se compara: igual, mayor que, incluido en lista… Define cuándo la condición se cumple (verdadero)." />
        </span>
        <select
          value={String(expression.operator ?? 'gte')}
          onChange={(event) => updateExpression({ operator: event.target.value })}
        >
          {operators.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Valor de comparación
          <InfoHint text="Contra qué se compara la variable. El campo se adapta al tipo de la variable elegida." />
        </span>
        {operator === 'in' || operator === 'contains' ? (
          <textarea
            key={`${code}-list`}
            rows={2}
            placeholder='Lista en JSON, p. ej. ["A","B"]'
            defaultValue={
              typeof expression.value === 'string'
                ? expression.value
                : JSON.stringify(expression.value ?? [])
            }
            onBlur={(event) => updateValue(event.target.value)}
          />
        ) : selectedType === 'BOOLEAN' ? (
          <select
            value={expression.value === true ? 'true' : expression.value === false ? 'false' : ''}
            onChange={(event) => updateExpression({ value: event.target.value === 'true' })}
          >
            <option value="">Elegir…</option>
            <option value="true">Verdadero</option>
            <option value="false">Falso</option>
          </select>
        ) : NUMERIC.has(selectedType) ? (
          <input
            type="number"
            value={
              expression.value === undefined || expression.value === null
                ? ''
                : String(expression.value)
            }
            onChange={(event) =>
              updateExpression({
                value: event.target.value === '' ? null : Number(event.target.value),
              })
            }
          />
        ) : (
          <input
            key={`${code}-text`}
            defaultValue={typeof expression.value === 'string' ? expression.value : ''}
            onBlur={(event) => updateValue(event.target.value)}
          />
        )}
      </label>
      <label className="field">
        <span>Severidad</span>
        <select
          value={display(condition, 'severity')}
          onChange={(event) => onChange({ severity: event.target.value })}
        >
          <option value="BLOCKING">Blocking</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
      </label>
    </section>
  );
}
