import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { normalizeObjectiveCode, type PolicyDraft } from './objective-authoring';

type ObjectivePolicyFieldsProps = {
  policies: PolicyDraft[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<PolicyDraft>) => void;
  onRemove: (index: number) => void;
};

/**
 * Step 3 of the objective form: the optional list of associated policies. Split out of
 * ObjectiveCreateDialog so that file stays under the 299-line source gate; the dialog owns
 * the policy state and passes the handlers down.
 */
export function ObjectivePolicyFields({
  policies,
  onAdd,
  onUpdate,
  onRemove,
}: ObjectivePolicyFieldsProps) {
  return (
    <section className="objective-form-section">
      <div className="objective-section-heading objective-policies-heading">
        <span>3</span>
        <div>
          <strong>Políticas asociadas</strong>
          <small>Puedes agregarlas ahora o vincular evidencia más adelante.</small>
        </div>
        <button className="button" type="button" onClick={onAdd}>
          <Plus size={14} /> Agregar política
        </button>
      </div>
      {!policies.length ? (
        <div className="objective-policies-empty">
          <CheckCircle2 size={17} />
          <span>El objetivo puede crearse sin políticas iniciales.</span>
        </div>
      ) : null}
      <div className="objective-policy-list">
        {policies.map((policy, index) => (
          <article className="objective-policy-card" key={`policy-${index + 1}`}>
            <header>
              <strong>Política {index + 1}</strong>
              <button
                type="button"
                aria-label={`Eliminar política ${index + 1}`}
                onClick={() => onRemove(index)}
              >
                <Trash2 size={14} />
              </button>
            </header>
            <div className="objective-form-grid">
              <label className="field">
                <span>Código</span>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  pattern="[A-Z0-9_-]{2,100}"
                  placeholder="POL_FRAUDE_01"
                  value={policy.policyCode}
                  onChange={(event) =>
                    onUpdate(index, { policyCode: normalizeObjectiveCode(event.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>Severidad</span>
                <select
                  value={policy.severity}
                  onChange={(event) => onUpdate(index, { severity: event.target.value })}
                >
                  <option value="INFO">Informativa</option>
                  <option value="WARNING">Advertencia</option>
                  <option value="BLOCKING">Bloqueante</option>
                </select>
              </label>
              <label className="field">
                <span>Responsable</span>
                <input
                  required
                  placeholder="Compliance"
                  value={policy.owner}
                  onChange={(event) => onUpdate(index, { owner: event.target.value })}
                />
              </label>
              <label className="field objective-field-wide">
                <span>Justificación</span>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe por qué esta política soporta el objetivo."
                  value={policy.rationale}
                  onChange={(event) => onUpdate(index, { rationale: event.target.value })}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
