import { asRecord, type UnknownRecord } from '../../utils/records';
import { OptionSelect } from '../../components/OptionSelect';
import { inputOption } from './graph-editor-help';
import { Field } from '../../components/Field';

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
      <Field
        label="Variable a evaluar"
        tooltip="El dato cuyo valor decide a qué rama ir. Cada caso compara esta variable con un valor y sigue un camino distinto."
      >
        <OptionSelect
          name="switchVariable"
          value={variable}
          onChange={(value) => onChange({ ...config, variable: value })}
          placeholder="Elegir variable…"
          options={inputs.map(inputOption)}
        />
      </Field>
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
