import { Trash2, X } from 'lucide-react';
import { asRows, display, type UnknownRecord } from '../../utils/records';

interface EdgePropertiesProps {
  edge: UnknownRecord;
  conditions: UnknownRecord[];
  onChange: (patch: UnknownRecord) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EdgeProperties({
  edge,
  conditions,
  onChange,
  onDelete,
  onClose,
}: EdgePropertiesProps) {
  const bindings = asRows(edge.conditions);
  const selectedCondition = bindings[0]?.code ? String(bindings[0].code) : '';
  const isDefault = Boolean(edge.default);

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
        {!isDefault ? (
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
        <button type="button" className="button button-danger full-width" onClick={onDelete}>
          <Trash2 size={14} /> Eliminar conexión
        </button>
      </section>
    </aside>
  );
}
