import { Trash2, X } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

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

interface EdgePropertiesProps {
  edge: UnknownRecord;
  conditions: UnknownRecord[];
  inputs?: UnknownRecord[];
  isSwitchBranch?: boolean;
  onChange: (patch: UnknownRecord) => void;
  onEditCondition?: (code: string, patch: UnknownRecord) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EdgeProperties({
  edge,
  conditions,
  inputs = [],
  isSwitchBranch = false,
  onChange,
  onEditCondition,
  onDelete,
  onClose,
}: EdgePropertiesProps) {
  const bindings = asRows(edge.conditions);
  const selectedCondition = bindings[0]?.code ? String(bindings[0].code) : '';
  const isDefault = Boolean(edge.default);
  const branchCondition = conditions.find(
    (condition) => display(condition, 'code') === selectedCondition,
  );
  const expression = asRecord(branchCondition?.expression);

  function updateCaseExpression(patch: UnknownRecord) {
    if (!onEditCondition || !selectedCondition) return;
    onEditCondition(selectedCondition, { expression: { ...expression, ...patch } });
  }

  function updateCaseValue(raw: string) {
    try {
      updateCaseExpression({ value: JSON.parse(raw) });
    } catch {
      updateCaseExpression({ value: raw });
    }
  }

  function setMode(mode: 'DEFAULT' | 'CONDITIONAL') {
    if (mode === 'DEFAULT') {
      onChange({ type: 'DEFAULT', default: true, conditions: [] });
      return;
    }
    const conditionCode = selectedCondition
      ? selectedCondition
      : conditions[0]
        ? display(conditions[0], 'code')
        : '';
    onChange({
      type: 'CONDITIONAL',
      default: false,
      conditions: conditionCode ? [{ code: conditionCode, order: 1 }] : [],
    });
  }

  return (
    <aside className="node-properties edge-properties">
      <div className="workbench-heading edge-properties-heading">
        <div>
          <strong>Propiedades de conexión</strong>
          <small>{display(edge, 'key')}</small>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar propiedades de conexión"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <section>
        <h3>Ruta</h3>
        <label className="field">
          <span>Desde</span>
          <input readOnly value={display(edge, 'from')} />
        </label>
        <label className="field">
          <span>Hacia</span>
          <input readOnly value={display(edge, 'to')} />
        </label>
        <label className="field">
          <span>Tipo de rama</span>
          <select
            value={isDefault ? 'DEFAULT' : 'CONDITIONAL'}
            onChange={(event) => setMode(event.target.value as 'DEFAULT' | 'CONDITIONAL')}
          >
            <option value="DEFAULT">Default / caso contrario</option>
            <option value="CONDITIONAL">Cuando se cumple</option>
          </select>
        </label>
        {!isDefault && !isSwitchBranch ? (
          <label className="field">
            <span>Condición</span>
            <select
              value={selectedCondition}
              onChange={(event) =>
                onChange({
                  conditions: event.target.value ? [{ code: event.target.value, order: 1 }] : [],
                })
              }
            >
              <option value="">Elegir condición…</option>
              {conditions.map((condition) => (
                <option key={display(condition, 'code')} value={display(condition, 'code')}>
                  {display(condition, 'name', 'code')}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!isDefault && isSwitchBranch && branchCondition && onEditCondition ? (
          <>
            <label className="field">
              <span>Variable del caso</span>
              <select
                value={String(expression.variable ?? '')}
                onChange={(event) => updateCaseExpression({ variable: event.target.value })}
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
              <span>Operador</span>
              <select
                value={String(expression.operator ?? 'eq')}
                onChange={(event) => updateCaseExpression({ operator: event.target.value })}
              >
                {operators.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Valor del caso</span>
              <textarea
                key={`${selectedCondition}-${JSON.stringify(expression.value)}`}
                rows={2}
                defaultValue={
                  typeof expression.value === 'string'
                    ? expression.value
                    : JSON.stringify(expression.value ?? null)
                }
                onBlur={(event) => updateCaseValue(event.target.value)}
              />
            </label>
          </>
        ) : null}
        <label className="field">
          <span>Prioridad</span>
          <input
            type="number"
            min={0}
            value={Number(edge.priority ?? 0)}
            onChange={(event) => onChange({ priority: Number(event.target.value) })}
          />
        </label>
      </section>
      <section>
        <ConfirmButton
          className="button button-danger full-width"
          title="¿Eliminar esta conexión?"
          confirmLabel="Eliminar la conexión"
          description={
            <p>
              El camino entre <b>{display(edge, 'fromNodeKey', 'from')}</b> y{' '}
              <b>{display(edge, 'toNodeKey', 'to')}</b> desaparece. Si era la única salida del paso
              de origen, el flujo se quedará sin continuación por ahí.
            </p>
          }
          onConfirm={onDelete}
        >
          <Trash2 size={14} /> Eliminar conexión
        </ConfirmButton>
      </section>
    </aside>
  );
}
