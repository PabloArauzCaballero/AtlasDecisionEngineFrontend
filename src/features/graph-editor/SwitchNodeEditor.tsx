import { asRecord, display, type UnknownRecord } from '../../utils/records';

interface SwitchNodeEditorProps {
  config: UnknownRecord;
  inputs: UnknownRecord[];
  branchCount: number;
  onChange: (config: UnknownRecord) => void;
}

/**
 * Editor for a SWITCH (multi-way) control node. Picks the variable being
 * switched on; each case branch is authored by connecting the node to a target
 * and editing that connection's condition.
 */
export function SwitchNodeEditor({ config, inputs, branchCount, onChange }: SwitchNodeEditorProps) {
  const variable = String(asRecord(config).variable ?? '');

  return (
    <section className="condition-node-editor">
      <h3>Switch (multi-caso)</h3>
      <label className="field">
        <span>Variable a evaluar</span>
        <select
          value={variable}
          onChange={(event) => onChange({ ...config, variable: event.target.value })}
        >
          <option value="">Elegir variable…</option>
          {inputs.map((input) => (
            <option key={display(input, 'code')} value={display(input, 'code')}>
              {display(input, 'code')} · {display(input, 'dataType')}
            </option>
          ))}
        </select>
      </label>
      <p className="field-hint">
        {branchCount === 0
          ? 'Conecta el switch a cada destino: la primera conexión es el caso por defecto (fail-closed) y las siguientes son casos con su propio valor.'
          : `${branchCount} rama(s). Haz clic en cada conexión para definir el valor del caso.`}
      </p>
      {!inputs.length ? (
        <p className="field-error">
          Sin variables a considerar: agrégalas arriba para poder enrutar el switch.
        </p>
      ) : null}
    </section>
  );
}
