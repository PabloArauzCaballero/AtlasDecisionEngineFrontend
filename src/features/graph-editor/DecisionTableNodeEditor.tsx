import { Plus, Trash2 } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { asRows, display, type UnknownRecord } from '../../utils/records';
import { defaultOperatorFor, operatorsFor } from './condition-operators';
import { OptionSelect } from '../../components/OptionSelect';
import { inputOption, operatorOptions } from './graph-editor-help';
import { Field } from '../../components/Field';

interface Props {
  config: UnknownRecord;
  inputs: UnknownRecord[];
  onChange: (config: UnknownRecord) => void;
}

/**
 * Rule-list editor for DECISION_TABLE nodes. Rules evaluate top-down and the
 * first match wins; each rule compares one declared input against a value and
 * yields a result. Values parse as JSON when possible, staying strings otherwise.
 */
export function DecisionTableNodeEditor({ config, inputs, onChange }: Props) {
  const rules = asRows(config.rules);
  /*
   * Tipo de la variable que compara cada regla. Decide qué operadores se ofrecen:
   * «mayor o igual» sobre un texto no significa nada y en JavaScript compara
   * alfabéticamente, así que la regla se guardaba y decidía por un criterio que
   * nadie había elegido.
   */
  const ruleType = (rule: UnknownRecord) =>
    display(
      inputs.find((input) => display(input, 'code') === display(rule, 'variable')) ?? {},
      'dataType',
    ).toUpperCase();

  function updateRule(index: number, patch: UnknownRecord) {
    onChange({
      ...config,
      rules: rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)),
    });
  }

  function commitJson(index: number, field: string, raw: string) {
    try {
      updateRule(index, { [field]: JSON.parse(raw) });
    } catch {
      updateRule(index, { [field]: raw });
    }
  }

  return (
    <section className="result-node-editor">
      <h3>Tabla de decisión</h3>
      {!inputs.length ? (
        <p className="field-error">
          Sin variables a considerar: agrégalas arriba para poder definir reglas.
        </p>
      ) : null}
      {rules.map((rule, index) => (
        <div className="result-assignment" key={index}>
          <Field
            label={`Regla ${index + 1} · Variable`}
            tooltip="Dato del caso que evalúa esta regla; las reglas se prueban en orden y gana la primera que se cumple."
          >
            <OptionSelect
              name="ruleVariable"
              value={display(rule, 'variable')}
              onChange={(value) => updateRule(index, { variable: value })}
              placeholder="Elegir…"
              options={inputs.map(inputOption)}
            />
          </Field>
          <Field
            label="Operador"
            tooltip="Cómo se compara la variable con el valor de la regla; los de lista esperan varios valores."
          >
            <OptionSelect
              name="ruleOperator"
              value={String(rule.operator ?? defaultOperatorFor(ruleType(rule)))}
              onChange={(value) => updateRule(index, { operator: value })}
              options={operatorOptions(operatorsFor(ruleType(rule)))}
            />
          </Field>
          <Field
            label="Valor a comparar"
            tooltip="Contra qué se compara la variable en esta regla. Ej.: 700, o APROBADO,REVISION para listas."
          >
            <input
              defaultValue={
                typeof rule.value === 'string' ? rule.value : JSON.stringify(rule.value ?? '')
              }
              onBlur={(event) => commitJson(index, 'value', event.target.value)}
            />
          </Field>
          <Field
            label="Resultado de la regla"
            tooltip="Lo que devuelve la tabla cuando esta regla es la primera que se cumple. Ej.: APROBADO."
          >
            <input
              defaultValue={
                typeof rule.result === 'string' ? rule.result : JSON.stringify(rule.result ?? '')
              }
              onBlur={(event) => commitJson(index, 'result', event.target.value)}
            />
          </Field>
          <ConfirmButton
            className="button button-danger full-width"
            title={`¿Quitar la regla ${index + 1} de la tabla?`}
            confirmLabel="Quitar la regla"
            description={
              <p>
                Los casos que hoy resuelve esta fila pasarán a la siguiente que coincida, o al
                resultado por defecto si no coincide ninguna. Revisa que ese cambio sea el que
                quieres antes de guardar.
              </p>
            }
            onConfirm={() =>
              onChange({ ...config, rules: rules.filter((_, ruleIndex) => ruleIndex !== index) })
            }
          >
            <Trash2 size={13} /> Quitar regla
          </ConfirmButton>
        </div>
      ))}
      <button
        className="button full-width"
        type="button"
        disabled={!inputs.length}
        onClick={() =>
          onChange({
            ...config,
            rules: [
              ...rules,
              { variable: inputs[0] ? display(inputs[0], 'code') : '', operator: 'eq', value: '' },
            ],
          })
        }
      >
        <Plus size={14} /> Añadir regla
      </button>
      <Field
        label="Resultado por defecto (sin coincidencias)"
        tooltip="Lo que devuelve la tabla si ninguna regla se cumple; evita dejar casos sin resultado."
      >
        <input
          defaultValue={
            typeof config.defaultResult === 'string'
              ? config.defaultResult
              : JSON.stringify(config.defaultResult ?? '')
          }
          onBlur={(event) => {
            try {
              onChange({ ...config, defaultResult: JSON.parse(event.target.value) });
            } catch {
              onChange({ ...config, defaultResult: event.target.value });
            }
          }}
        />
      </Field>
      <small className="field-hint">
        Las reglas se evalúan en orden y gana la primera coincidencia; sin coincidencias aplica el
        resultado por defecto (fail-closed si queda vacío).
      </small>
    </section>
  );
}
