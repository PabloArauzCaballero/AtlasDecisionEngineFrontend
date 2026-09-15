'use client';

import { ArtifactVersionPicker } from '../../components/ArtifactVersionPicker';
import { Field } from '../../components/Field';

export interface MonitoringForm {
  versionId: string;
  from: string;
  to: string;
  variableCode: string;
  referenceFrom: string;
  referenceTo: string;
  attribute: string;
}

interface MonitoringControlsProps {
  form: MonitoringForm;
  onChange: (patch: Partial<MonitoringForm>) => void;
  onRun: () => void;
  running: boolean;
}

/**
 * Qué se mide y sobre qué ventana.
 *
 * La ventana de REFERENCIA es un campo aparte y obligatorio para la estabilidad, no un valor por
 * omisión escondido: comparar contra «los últimos seis meses» sin decirlo hace que el índice cambie
 * cada día por razones que no son el modelo, y nadie puede reproducir la cifra de ayer.
 */
export function MonitoringControls({ form, onChange, onRun, running }: MonitoringControlsProps) {
  return (
    <form
      className="monitoring-controls"
      onSubmit={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      <ArtifactVersionPicker
        versionId={form.versionId}
        onVersionChange={(versionId) => onChange({ versionId })}
        versionLabel="Versión a monitorear"
        required
      />

      <div className="monitoring-field-row">
        <Field label="Ventana actual — desde" tooltip="Inicio del periodo que se mide ahora.">
          <input
            type="date"
            value={form.from}
            onChange={(event) => onChange({ from: event.target.value })}
          />
        </Field>
        <Field label="Ventana actual — hasta" tooltip="Fin del periodo que se mide ahora.">
          <input
            type="date"
            value={form.to}
            onChange={(event) => onChange({ to: event.target.value })}
          />
        </Field>
      </div>

      <div className="monitoring-field-row" data-tutorial-id="monitoring-comparison">
        <Field
          label="Variable a comparar"
          tooltip="Variable cuya distribución se compara entre referencia y ventana actual. Ej.: ingresos_mensuales."
        >
          <input
            value={form.variableCode}
            placeholder="ingresos_mensuales"
            onChange={(event) => onChange({ variableCode: event.target.value })}
          />
        </Field>
        <Field
          label="Atributo de sesgo"
          tooltip="Atributo de la población con el que se comparan los grupos. Ej.: AGE_BAND."
        >
          <input
            value={form.attribute}
            placeholder="AGE_BAND"
            onChange={(event) => onChange({ attribute: event.target.value })}
          />
        </Field>
      </div>

      <div className="monitoring-field-row" data-tutorial-id="monitoring-reference">
        <Field
          label="Referencia — desde"
          tooltip="Inicio del periodo de referencia contra el que se compara."
        >
          <input
            type="date"
            value={form.referenceFrom}
            onChange={(event) => onChange({ referenceFrom: event.target.value })}
          />
        </Field>
        <Field
          label="Referencia — hasta"
          tooltip="Fin del periodo de referencia contra el que se compara."
        >
          <input
            type="date"
            value={form.referenceTo}
            onChange={(event) => onChange({ referenceTo: event.target.value })}
          />
        </Field>
      </div>

      <button
        type="submit"
        className="primary"
        data-tutorial-id="monitoring-run"
        disabled={!form.versionId || running}
      >
        {running ? 'Midiendo…' : 'Medir'}
      </button>
    </form>
  );
}
