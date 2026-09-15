import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { asRecord, display, type UnknownRecord } from '../../utils/records';
import { ObjectivePolicyFields } from './ObjectivePolicyFields';
import {
  buildObjectivePayload,
  createPolicyDraft,
  normalizeObjectiveCode,
  type PolicyDraft,
} from './objective-authoring';
import { Field } from '../../components/Field';

type ObjectiveCreateDialogProps = { onClose: () => void };

export function ObjectiveCreateDialog({ onClose }: ObjectiveCreateDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLElement>(null);
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

  useDialogFocus(dialog, codeInput);

  useEffect(() => {
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
        ref={dialog}
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
                <Field
                  label="Código del objetivo"
                  tooltip="Identificador del objetivo en mayúsculas, números y guiones. Ej.: REDUCIR_FRAUDE."
                >
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
                </Field>
                <Field
                  label="Equipo responsable"
                  tooltip="Equipo que responde por el objetivo. Ej.: Riesgo de Crédito."
                >
                  <input
                    required
                    placeholder="Riesgo de Crédito"
                    value={ownerTeam}
                    onChange={(event) => setOwnerTeam(event.target.value)}
                  />
                </Field>
                <Field
                  className="objective-field-wide"
                  label="Nombre del objetivo"
                  tooltip="Nombre legible del objetivo de negocio."
                >
                  <input
                    required
                    placeholder="Reducir fraude en originación digital"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </Field>
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
                <Field
                  className="objective-field-wide"
                  label="Métrica"
                  tooltip="Indicador con el que se mide el objetivo. Ej.: tasa de fraude confirmado."
                >
                  <input
                    required
                    placeholder="Tasa de fraude confirmado"
                    value={metric}
                    onChange={(event) => setMetric(event.target.value)}
                  />
                </Field>
                <Field label="Meta" tooltip="Valor que la métrica debe alcanzar. Ej.: menor a 0.8.">
                  <input
                    required
                    placeholder="Menor a 0.8"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  />
                </Field>
                <Field
                  label="Unidad (opcional)"
                  tooltip="Unidad en la que se expresa la meta. Ej.: %."
                >
                  <input
                    placeholder="%"
                    value={targetUnit}
                    onChange={(event) => setTargetUnit(event.target.value)}
                  />
                </Field>
              </div>
            </section>
            <ObjectivePolicyFields
              policies={policies}
              onAdd={addPolicy}
              onUpdate={updatePolicy}
              onRemove={(index) =>
                setPolicies((current) => current.filter((_, policyIndex) => policyIndex !== index))
              }
            />
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
