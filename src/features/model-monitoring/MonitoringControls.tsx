'use client';

import { ArtifactVersionPicker } from '../../components/ArtifactVersionPicker';

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
        <label>
          <span>Ventana actual — desde</span>
          <input
            type="date"
            value={form.from}
            onChange={(event) => onChange({ from: event.target.value })}
          />
        </label>
        <label>
          <span>Ventana actual — hasta</span>
          <input
            type="date"
            value={form.to}
            onChange={(event) => onChange({ to: event.target.value })}
          />
        </label>
      </div>

      <div className="monitoring-field-row" data-tutorial-id="monitoring-comparison">
        <label>
          <span>Variable a comparar</span>
          <input
            value={form.variableCode}
            placeholder="ingresos_mensuales"
            onChange={(event) => onChange({ variableCode: event.target.value })}
          />
        </label>
        <label>
          <span>Atributo de sesgo</span>
          <input
            value={form.attribute}
            placeholder="AGE_BAND"
            onChange={(event) => onChange({ attribute: event.target.value })}
          />
        </label>
      </div>

      <div className="monitoring-field-row" data-tutorial-id="monitoring-reference">
        <label>
          <span>Referencia — desde</span>
          <input
            type="date"
            value={form.referenceFrom}
            onChange={(event) => onChange({ referenceFrom: event.target.value })}
          />
        </label>
        <label>
          <span>Referencia — hasta</span>
          <input
            type="date"
            value={form.referenceTo}
            onChange={(event) => onChange({ referenceTo: event.target.value })}
          />
        </label>
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
