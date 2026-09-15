import { Trash2, X } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { defaultOperatorFor, isOperatorValidFor, operatorsFor } from './condition-operators';
import { CONDITION_ORIGIN } from './node-tutorials';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { OptionSelect } from '../../components/OptionSelect';
import { EDGE_KIND_HELP, closedOptions, inputOption, operatorOptions } from './graph-editor-help';
import { Field } from '../../components/Field';

/** Fuera del JSX: el ejemplo lleva comillas y corchetes que allí habría que escapar. */
const CASE_VALUE_HINT =
  'El valor con el que se compara, escrito con su tipo real: 1500 para un número, ' +
  'true para un booleano, «APROBADO» para un texto, ["A","B"] para una lista.';

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
  /*
   * Tipo de la variable que reparte el switch. Decide qué comparaciones se
   * ofrecen: preguntar si un estado de KYC es «mayor o igual» que otro no
   * significa nada, y en JavaScript compara alfabéticamente, así que la rama se
   * guardaba y decidía por un criterio que nadie había elegido.
   */
  const caseType = display(
    inputs.find((input) => display(input, 'code') === String(expression.variable ?? '')) ?? {},
    'dataType',
  ).toUpperCase();

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
        <Field
          label="Desde"
          tooltip="Paso del que SALE esta conexión. No se edita aquí: se cambia arrastrando la flecha en el lienzo."
        >
          <input readOnly value={display(edge, 'from')} />
        </Field>
        <Field
          label="Hacia"
          tooltip="Paso al que LLEGA esta conexión. No se edita aquí: se cambia arrastrando la flecha en el lienzo."
        >
          <input readOnly value={display(edge, 'to')} />
        </Field>
        <Field
          label="Tipo de rama"
          tooltip="«Cuando se cumple» recorre este camino sólo si su condición es cierta. «Default / caso contrario» es la salida de escape: la toma todo lo que no encajó en ninguna otra rama. Cada bifurcación necesita exactamente una por defecto, o un caso no contemplado dejaría la decisión sin camino."
        >
          <OptionSelect
            name="edgeKind"
            value={isDefault ? 'DEFAULT' : 'CONDITIONAL'}
            onChange={(value) => setMode(value as 'DEFAULT' | 'CONDITIONAL')}
            options={closedOptions(
              [
                { value: 'DEFAULT', label: 'Default / caso contrario' },
                { value: 'CONDITIONAL', label: 'Cuando se cumple' },
              ],
              EDGE_KIND_HELP,
            )}
          />
        </Field>
        {!isDefault && !isSwitchBranch ? (
          <Field label="Condición" tooltip={CONDITION_ORIGIN}>
            <OptionSelect
              name="edgeCondition"
              value={selectedCondition}
              onChange={(value) =>
                onChange({
                  conditions: value ? [{ code: value, order: 1 }] : [],
                })
              }
              placeholder="Elegir condición…"
              options={conditions.map((condition) => ({
                value: display(condition, 'code'),
                label: display(condition, 'name', 'code'),
                description: display(condition, 'code'),
              }))}
            />
          </Field>
        ) : null}
        {!isDefault && isSwitchBranch && branchCondition && onEditCondition ? (
          <>
            <Field
              label="Variable del caso"
              tooltip="La variable que el Switch reparte. Sólo aparecen las declaradas en «Entradas · Variables a considerar»: si la que buscas no está, decláurala allí primero."
            >
              <OptionSelect
                name="caseVariable"
                value={String(expression.variable ?? '')}
                onChange={(value) => {
                  const nextType = display(
                    inputs.find((input) => display(input, 'code') === value) ?? {},
                    'dataType',
                  ).toUpperCase();
                  const current = String(expression.operator ?? '');
                  updateCaseExpression({
                    variable: value,
                    operator: isOperatorValidFor(nextType, current)
                      ? current
                      : defaultOperatorFor(nextType),
                  });
                }}
                placeholder="Elegir variable…"
                options={inputs.map(inputOption)}
              />
            </Field>
            <Field
              label="Operador"
              tooltip="Cómo se compara la variable con el valor del caso. Los de lista («Incluido en lista», «Contiene») esperan varios valores; el resto, uno solo."
            >
              <OptionSelect
                name="caseOperator"
                value={String(expression.operator ?? defaultOperatorFor(caseType))}
                onChange={(value) => updateCaseExpression({ operator: value })}
                options={operatorOptions(operatorsFor(caseType))}
              />
            </Field>
            <Field label="Valor del caso" tooltip={CASE_VALUE_HINT}>
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
            </Field>
          </>
        ) : null}
        <Field
          label="Prioridad"
          tooltip="Orden en el que el motor prueba las salidas de un mismo paso: el número más BAJO se evalúa primero y gana la primera que se cumple. Dos ramas que puedan cumplirse a la vez con la misma prioridad harían la decisión no determinista."
        >
          <input
            type="number"
            min={0}
            value={Number(edge.priority ?? 0)}
            onChange={(event) => onChange({ priority: Number(event.target.value) })}
          />
        </Field>
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
