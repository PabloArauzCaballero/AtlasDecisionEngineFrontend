import { type UnknownRecord } from '../../utils/records';

interface Props {
  config: UnknownRecord;
  onChange: (config: UnknownRecord) => void;
}

/**
 * Routing form for MANUAL_REVIEW nodes: which queue receives the case, with
 * what priority and reason. The fields mirror the manual-reviews domain so the
 * case detail page renders exactly what was configured here.
 */
export function ManualReviewNodeEditor({ config, onChange }: Props) {
  return (
    <section className="condition-node-editor">
      <h3>Derivación a revisión manual</h3>
      <label className="field">
        <span>Cola destino</span>
        <input
          value={String(config.queueCode ?? '')}
          placeholder="FRAUD_QUEUE"
          onChange={(event) => onChange({ ...config, queueCode: event.target.value.toUpperCase() })}
        />
      </label>
      <label className="field">
        <span>Prioridad</span>
        <select
          value={String(config.priority ?? 'MEDIUM')}
          onChange={(event) => onChange({ ...config, priority: event.target.value })}
        >
          <option value="LOW">Baja</option>
          <option value="MEDIUM">Media</option>
          <option value="HIGH">Alta</option>
          <option value="CRITICAL">Crítica</option>
        </select>
      </label>
      <label className="field">
        <span>Motivo mostrado al analista</span>
        <textarea
          rows={3}
          value={String(config.reason ?? '')}
          placeholder="Describe por qué el caso requiere decisión humana…"
          onChange={(event) => onChange({ ...config, reason: event.target.value })}
        />
      </label>
      {!String(config.queueCode ?? '').trim() ? (
        <p className="field-hint">Sin cola destino, el motor rechazará la compilación del grafo.</p>
      ) : null}
    </section>
  );
}
