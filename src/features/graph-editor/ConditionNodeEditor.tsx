import { InfoHint } from '../../components/InfoHint';
import { asRecord, display, type UnknownRecord } from '../../utils/records';
import {
  defaultOperatorFor,
  expectsList,
  expectsText,
  isComposite,
  isOperatorValidFor,
  OPERATOR_LABELS,
  operatorsFor,
  readComparison,
} from './condition-operators';

interface ConditionNodeEditorProps {
  condition: UnknownRecord;
  inputs: UnknownRecord[];
  onChange: (patch: UnknownRecord) => void;
  /** Creates a condition bound to this node from the chosen input variable. */
  onCreateCondition?: (variableCode: string) => void;
}

const NUMERIC = new Set(['NUMBER', 'INTEGER', 'INT', 'DECIMAL', 'FLOAT', 'PERCENTAGE']);

export function ConditionNodeEditor({
  condition,
  inputs,
  onChange,
  onCreateCondition,
}: ConditionNodeEditorProps) {
  const expression = asRecord(condition.expression);
  const code = display(condition, 'code');
  /*
   * Hay dos formas guardadas y el motor evalúa las dos: la plana que escribe este
   * editor y la de árbol que producen el compilador y los seeders. Leyendo sólo la
   * primera, una condición sembrada aparecía con TODOS los campos vacíos, como si
   * no estuviera configurada — cuando lo estaba y decidía bien.
   */
  const parsed = readComparison(condition.expression);
  const composite = isComposite(condition.expression);
  const variableCode = parsed?.variable ?? '';
  const selectedType = display(
    inputs.find((input) => display(input, 'code') === variableCode) ?? {},
    'dataType',
  ).toUpperCase();
  /*
   * El operador de partida depende del tipo: `gte` sólo significa algo donde hay
   * orden. Antes se ofrecía «mayor o igual» también sobre un texto, y como en
   * JavaScript eso compara alfabéticamente, la condición se guardaba y decidía
   * por un criterio que nadie había elegido.
   */
  const operator = parsed?.operator ?? defaultOperatorFor(selectedType);
  const available = operatorsFor(selectedType);

  function updateExpression(patch: UnknownRecord) {
    // Se reescribe SIEMPRE en forma plana y completa. Fusionar el parche sobre una
    // expresión de árbol dejaría un híbrido con `op` y `operator` a la vez, que el
    // motor resolvería por la rama plana ignorando el resto en silencio.
    const base = { variable: variableCode, operator, value: parsed?.value };
    onChange({ expression: { ...base, ...patch } });
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
      {composite ? (
        <p className="field-hint condition-composite">
          Esta condición combina varias comparaciones (por ejemplo «A o B»), así que no cabe en los
          tres campos de abajo. Se muestra tal cual está guardada; si eliges variable y operador
          aquí, <b>la reemplazarás por una comparación simple</b>.
          <code>{JSON.stringify(condition.expression)}</code>
        </p>
      ) : null}
      <label className="field">
        <span>
          Variable de entrada
          <InfoHint text="El dato que se compara (p. ej. score_buro). Debe estar declarado como entrada del algoritmo." />
        </span>
        <select
          value={String(expression.variable ?? '')}
          onChange={(event) => {
            const nextType = display(
              inputs.find((input) => display(input, 'code') === event.target.value) ?? {},
              'dataType',
            ).toUpperCase();
            // Cambiar de `edad` a `estado_kyc` conservando «mayor o igual» dejaría
            // una condición que el motor acepta y que no quiere decir nada.
            updateExpression({
              variable: event.target.value,
              operator: isOperatorValidFor(nextType, operator)
                ? operator
                : defaultOperatorFor(nextType),
            });
          }}
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
          value={operator}
          onChange={(event) => updateExpression({ operator: event.target.value })}
        >
          {available.map((value) => (
            <option key={value} value={value}>
              {OPERATOR_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Valor de comparación
          <InfoHint text="Contra qué se compara la variable. El campo se adapta al tipo de la variable elegida." />
        </span>
        {expectsList(operator) ? (
          <textarea
            key={`${code}-list`}
            rows={2}
            placeholder='Lista en JSON, p. ej. ["A","B"]'
            defaultValue={
              typeof parsed?.value === 'string' ? parsed.value : JSON.stringify(parsed?.value ?? [])
            }
            onBlur={(event) => updateValue(event.target.value)}
          />
        ) : selectedType === 'BOOLEAN' ? (
          <select
            value={parsed?.value === true ? 'true' : parsed?.value === false ? 'false' : ''}
            onChange={(event) => updateExpression({ value: event.target.value === 'true' })}
          >
            <option value="">Elegir…</option>
            <option value="true">Verdadero</option>
            <option value="false">Falso</option>
          </select>
        ) : expectsText(operator) ? (
          <input
            key={`${code}-match`}
            placeholder="Texto a buscar"
            defaultValue={typeof parsed?.value === 'string' ? parsed.value : ''}
            onBlur={(event) => updateExpression({ value: event.target.value })}
          />
        ) : NUMERIC.has(selectedType) ? (
          <input
            type="number"
            value={
              parsed?.value === undefined || parsed?.value === null ? '' : String(parsed?.value)
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
            defaultValue={typeof parsed?.value === 'string' ? parsed.value : ''}
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
