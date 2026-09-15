import { asRecord, display, type UnknownRecord } from '../../utils/records';
import {
  defaultOperatorFor,
  expectsList,
  expectsText,
  isComposite,
  isOperatorValidFor,
  operatorsFor,
  readComparison,
} from './condition-operators';
import { OptionSelect } from '../../components/OptionSelect';
import { BOOLEAN_VALUE_HELP, CONDITION_SEVERITY_HELP } from './graph-node-help';
import { closedOptions, inputOption, operatorOptions } from './graph-editor-help';
import { Field } from '../../components/Field';

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
        <Field
          label="Variable a evaluar"
          tooltip="El dato de entrada sobre el que se decide (p. ej. score_buro). Al elegirlo se crea la condición editable."
        >
          <OptionSelect
            name="newConditionVariable"
            value=""
            onChange={(value) => value && onCreateCondition?.(value)}
            placeholder="Elegir variable de entrada…"
            options={inputs.map(inputOption)}
          />
        </Field>
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
      <Field
        label="Código"
        tooltip="Identificador único de la condición dentro del algoritmo. Ej.: SCORE_MINIMO. Las ramas la citan por él."
      >
        <input readOnly value={code} />
      </Field>
      <Field
        label="Nombre"
        tooltip="Nombre legible de la condición, el que se ve en el lienzo y en la traza."
      >
        <input
          defaultValue={display(condition, 'name')}
          onBlur={(event) => onChange({ name: event.target.value })}
        />
      </Field>
      {composite ? (
        <p className="field-hint condition-composite">
          Esta condición combina varias comparaciones (por ejemplo «A o B»), así que no cabe en los
          tres campos de abajo. Se muestra tal cual está guardada; si eliges variable y operador
          aquí, <b>la reemplazarás por una comparación simple</b>.
          <code>{JSON.stringify(condition.expression)}</code>
        </p>
      ) : null}
      <Field
        label="Variable de entrada"
        tooltip="El dato que se compara (p. ej. score_buro). Debe estar declarado como entrada del algoritmo."
      >
        <OptionSelect
          name="conditionVariable"
          value={String(expression.variable ?? '')}
          onChange={(value) => {
            const nextType = display(
              inputs.find((input) => display(input, 'code') === value) ?? {},
              'dataType',
            ).toUpperCase();
            // Cambiar de `edad` a `estado_kyc` conservando «mayor o igual» dejaría
            // una condición que el motor acepta y que no quiere decir nada.
            updateExpression({
              variable: value,
              operator: isOperatorValidFor(nextType, operator)
                ? operator
                : defaultOperatorFor(nextType),
            });
          }}
          placeholder="Elegir variable…"
          options={inputs.map(inputOption)}
        />
      </Field>
      <Field
        label="Operador"
        tooltip="Cómo se compara: igual, mayor que, incluido en lista… Define cuándo la condición se cumple (verdadero)."
      >
        <OptionSelect
          name="conditionOperator"
          value={operator}
          onChange={(value) => updateExpression({ operator: value })}
          options={operatorOptions(available)}
        />
      </Field>
      <Field
        label="Valor de comparación"
        tooltip="Contra qué se compara la variable. El campo se adapta al tipo de la variable elegida."
      >
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
          <OptionSelect
            name="conditionBoolean"
            value={parsed?.value === true ? 'true' : parsed?.value === false ? 'false' : ''}
            onChange={(value) => updateExpression({ value: value === 'true' })}
            placeholder="Elegir…"
            options={closedOptions(
              [
                { value: 'true', label: 'Verdadero' },
                { value: 'false', label: 'Falso' },
              ],
              BOOLEAN_VALUE_HELP,
            )}
          />
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
      </Field>
      <Field
        label="Severidad"
        tooltip="Qué consecuencia tiene que la condición no se cumpla: bloquear, avisar o sólo registrar."
      >
        <OptionSelect
          name="conditionSeverity"
          value={display(condition, 'severity')}
          onChange={(value) => onChange({ severity: value })}
          options={closedOptions(
            [
              { value: 'BLOCKING', label: 'Blocking' },
              { value: 'WARNING', label: 'Warning' },
              { value: 'INFO', label: 'Info' },
            ],
            CONDITION_SEVERITY_HELP,
          )}
        />
      </Field>
    </section>
  );
}
