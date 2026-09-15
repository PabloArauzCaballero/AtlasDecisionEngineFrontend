import { type UnknownRecord } from '../../utils/records';
import { OptionSelect } from '../../components/OptionSelect';
import { REVIEW_PRIORITY_HELP, closedOptions } from './graph-editor-help';
import { Field } from '../../components/Field';

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
      <Field
        label="Cola destino"
        tooltip="A qué bandeja de revisión manual se envía el caso (p. ej. FRAUD_QUEUE). Un analista de esa cola lo resolverá."
      >
        <input
          value={String(config.queueCode ?? '')}
          placeholder="FRAUD_QUEUE"
          onChange={(event) => onChange({ ...config, queueCode: event.target.value.toUpperCase() })}
        />
      </Field>
      <Field
        label="Prioridad"
        tooltip="Urgencia del caso en la cola. Los casos críticos se atienden antes."
      >
        <OptionSelect
          name="priority"
          value={String(config.priority ?? 'MEDIUM')}
          onChange={(value) => onChange({ ...config, priority: value })}
          options={closedOptions(
            [
              { value: 'LOW', label: 'Baja' },
              { value: 'MEDIUM', label: 'Media' },
              { value: 'HIGH', label: 'Alta' },
              { value: 'CRITICAL', label: 'Crítica' },
            ],
            REVIEW_PRIORITY_HELP,
          )}
        />
      </Field>
      <Field
        label="Motivo mostrado al analista"
        tooltip="Texto que el analista lee al abrir el caso: por qué llegó a su bandeja y qué revisar."
      >
        <textarea
          rows={3}
          value={String(config.reason ?? '')}
          placeholder="Describe por qué el caso requiere decisión humana…"
          onChange={(event) => onChange({ ...config, reason: event.target.value })}
        />
      </Field>
      {!String(config.queueCode ?? '').trim() ? (
        <p className="field-hint">Sin cola destino, el motor rechazará la compilación del grafo.</p>
      ) : null}
    </section>
  );
}
