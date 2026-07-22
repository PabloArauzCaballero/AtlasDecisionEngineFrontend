import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Target, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { asRecord, display, type UnknownRecord } from '../../utils/records';
import {
  buildObjectivePayload,
  createPolicyDraft,
  normalizeObjectiveCode,
  type PolicyDraft,
} from './objective-authoring';

type ObjectiveCreateDialogProps = { onClose: () => void };

export function ObjectiveCreateDialog({ onClose }: ObjectiveCreateDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const codeInput = useRef<HTMLInputElement>(null);
  const [objectiveCode, setObjectiveCode] = useState('');
  const [name, setName] = useState('');
  const [metric, setMetric] = useState('');
  const [target, setTarget] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [ownerTeam, setOwnerTeam] = useState('');
  const [policies, setPolicies] = useState<PolicyDraft[]>([]);

  const create = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>('/v1/traceability/objectives', {
        method: 'POST',
        body: buildObjectivePayload({
          objectiveCode,
          name,
          metric,
          target,
          targetUnit,
          ownerTeam,
          policies,
        }),
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['resource', 'objectives'] });
      const id = display(asRecord(created), 'id');
      onClose();
      if (id && id !== '—') router.push(`/objectives/${encodeURIComponent(id)}`);
    },
  });

  useEffect(() => {
    codeInput.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !create.isPending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [create.isPending, onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  function updatePolicy(index: number, patch: Partial<PolicyDraft>) {
    setPolicies((current) =>
      current.map((policy, policyIndex) =>
        policyIndex === index ? { ...policy, ...patch } : policy,
      ),
    );
  }

  function addPolicy() {
    setPolicies((current) => [...current, createPolicyDraft(ownerTeam)]);
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !create.isPending) onClose();
      }}
    >
      <section
        className="objective-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="objective-create-title"
      >
        <header className="dialog-heading">
          <span className="dialog-heading-icon" aria-hidden="true">
            <Target size={20} />
          </span>
          <div>
            <p>Business Traceability</p>
            <h2 id="objective-create-title">Crear objetivo de negocio</h2>
            <span>Define la meta que después conectarás con políticas, artefactos y pruebas.</span>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Cerrar formulario"
            disabled={create.isPending}
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="dialog-body">
            {create.isError ? <Alert tone="error">{errorMessage(create.error)}</Alert> : null}
            <section className="objective-form-section">
              <div className="objective-section-heading">
                <span>1</span>
                <div>
                  <strong>Identidad y responsable</strong>
                  <small>Usa un código estable y un nombre claro para toda la organización.</small>
                </div>
              </div>
              <div className="objective-form-grid">
                <label className="field">
                  <span>Código del objetivo</span>
                  <input
                    ref={codeInput}
                    required
                    minLength={2}
                    maxLength={100}
                    pattern="[A-Z0-9_-]{2,100}"
                    placeholder="REDUCIR_FRAUDE_2026"
                    value={objectiveCode}
                    onChange={(event) =>
                      setObjectiveCode(normalizeObjectiveCode(event.target.value))
                    }
                  />
                  <small>Mayúsculas, números, guion o guion bajo.</small>
                </label>
                <label className="field">
                  <span>Equipo responsable</span>
                  <input
                    required
                    placeholder="Riesgo de Crédito"
                    value={ownerTeam}
                    onChange={(event) => setOwnerTeam(event.target.value)}
                  />
                </label>
                <label className="field objective-field-wide">
                  <span>Nombre del objetivo</span>
                  <input
                    required
                    placeholder="Reducir fraude en originación digital"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className="objective-form-section">
              <div className="objective-section-heading">
                <span>2</span>
                <div>
                  <strong>Métrica y resultado esperado</strong>
                  <small>La meta quedará visible en el seguimiento del objetivo.</small>
                </div>
              </div>
              <div className="objective-form-grid objective-target-grid">
                <label className="field objective-field-wide">
                  <span>Métrica</span>
                  <input
                    required
                    placeholder="Tasa de fraude confirmado"
                    value={metric}
                    onChange={(event) => setMetric(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Meta</span>
                  <input
                    required
                    placeholder="Menor a 0.8"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Unidad (opcional)</span>
                  <input
                    placeholder="%"
                    value={targetUnit}
                    onChange={(event) => setTargetUnit(event.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className="objective-form-section">
              <div className="objective-section-heading objective-policies-heading">
                <span>3</span>
                <div>
                  <strong>Políticas asociadas</strong>
                  <small>Puedes agregarlas ahora o vincular evidencia más adelante.</small>
                </div>
                <button className="button" type="button" onClick={addPolicy}>
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
                        onClick={() =>
                          setPolicies((current) =>
                            current.filter((_, policyIndex) => policyIndex !== index),
                          )
                        }
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
                            updatePolicy(index, {
                              policyCode: normalizeObjectiveCode(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Severidad</span>
                        <select
                          value={policy.severity}
                          onChange={(event) =>
                            updatePolicy(index, { severity: event.target.value })
                          }
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
                          onChange={(event) => updatePolicy(index, { owner: event.target.value })}
                        />
                      </label>
                      <label className="field objective-field-wide">
                        <span>Justificación</span>
                        <textarea
                          required
                          rows={2}
                          placeholder="Describe por qué esta política soporta el objetivo."
                          value={policy.rationale}
                          onChange={(event) =>
                            updatePolicy(index, { rationale: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
          <footer className="dialog-actions">
            <button className="button" type="button" disabled={create.isPending} onClick={onClose}>
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={create.isPending}>
              <Target size={16} /> {create.isPending ? 'Creando objetivo…' : 'Crear objetivo'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
