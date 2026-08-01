import { Plus, Trash2 } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  config: UnknownRecord;
  inputs: UnknownRecord[];
  onChange: (config: UnknownRecord) => void;
}

/** Same operator vocabulary the visual condition editor exposes. */
const OPERATORS = [
  ['eq', 'Igual a'],
  ['neq', 'Distinto de'],
  ['gt', 'Mayor que'],
  ['gte', 'Mayor o igual'],
  ['lt', 'Menor que'],
  ['lte', 'Menor o igual'],
  ['in', 'Incluido en lista'],
] as const;

/**
 * Rule-list editor for DECISION_TABLE nodes. Rules evaluate top-down and the
 * first match wins; each rule compares one declared input against a value and
 * yields a result. Values parse as JSON when possible, staying strings otherwise.
 */
export function DecisionTableNodeEditor({ config, inputs, onChange }: Props) {
  const rules = asRows(config.rules);

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
          <label className="field">
            <span>Regla {index + 1} · Variable</span>
            <select
              value={display(rule, 'variable')}
              onChange={(event) => updateRule(index, { variable: event.target.value })}
            >
              <option value="">Elegir…</option>
              {inputs.map((input) => (
                <option key={display(input, 'code')} value={display(input, 'code')}>
                  {display(input, 'code')} · {display(input, 'dataType')}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Operador</span>
            <select
              value={String(rule.operator ?? 'eq')}
              onChange={(event) => updateRule(index, { operator: event.target.value })}
            >
              {OPERATORS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Valor a comparar</span>
            <input
              defaultValue={
                typeof rule.value === 'string' ? rule.value : JSON.stringify(rule.value ?? '')
              }
              onBlur={(event) => commitJson(index, 'value', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Resultado de la regla</span>
            <input
              defaultValue={
                typeof rule.result === 'string' ? rule.result : JSON.stringify(rule.result ?? '')
              }
              onBlur={(event) => commitJson(index, 'result', event.target.value)}
            />
          </label>
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
      <label className="field">
        <span>Resultado por defecto (sin coincidencias)</span>
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
      </label>
      <small className="field-hint">
        Las reglas se evalúan en orden y gana la primera coincidencia; sin coincidencias aplica el
        resultado por defecto (fail-closed si queda vacío).
      </small>
    </section>
  );
}
