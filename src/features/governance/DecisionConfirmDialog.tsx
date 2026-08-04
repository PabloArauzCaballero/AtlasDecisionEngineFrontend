'use client';

import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { ModalDialog } from '../../components/ModalDialog';
import { StatusBadge } from '../../components/StatusBadge';
import type { GateReport } from './approval-gates';
import { isPassingGate } from './approval-gates';
import type { Decision } from './useApprovalDecision';

export interface DecisionSubject {
  requestLabel: string;
  artifactName: string;
  artifactCode: string;
  versionLabel: string;
  /** Rol con el que se firma el paso, tal como lo declara el backend. */
  requiredRole: string | null;
  stepLabel: string;
}

interface DecisionConfirmDialogProps {
  decision: Decision;
  subject: DecisionSubject;
  gates: GateReport;
  comments: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmación explícita antes de firmar un paso de aprobación.
 *
 * Antes, «Aprobar Despliegue» disparaba el POST con el primer clic. Firmar es
 * irreversible y queda en la bitácora con tu nombre, así que la acción se
 * enseña entera —qué artefacto, qué versión, con qué rol, qué consecuencia y
 * qué evidencia hay o falta— antes de ejecutarla.
 */
export function DecisionConfirmDialog({
  decision,
  subject,
  gates,
  comments,
  pending,
  onCancel,
  onConfirm,
}: DecisionConfirmDialogProps) {
  const approving = decision === 'APPROVE';
  const missingEvidence = !gates.reported || gates.failing.length > 0;

  return (
    <ModalDialog
      title={approving ? 'Confirmar aprobación' : 'Confirmar rechazo'}
      subtitle={`${subject.requestLabel} · ${subject.stepLabel}`}
      tone={approving ? 'default' : 'danger'}
      icon={approving ? <ShieldCheck /> : <ShieldAlert />}
      onClose={onCancel}
      actions={
        <>
          <button className="button" type="button" onClick={onCancel} disabled={pending}>
            Cancelar
          </button>
          <button
            className={approving ? 'button button-primary' : 'button button-danger'}
            type="button"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? <span className="inline-spinner" aria-hidden="true" /> : null}
            {approving ? 'Firmar aprobación' : 'Firmar rechazo'}
          </button>
        </>
      }
    >
      <dl className="decision-summary">
        <div>
          <dt>Artefacto</dt>
          <dd>
            {subject.artifactName} <code>{subject.artifactCode}</code>
          </dd>
        </div>
        <div>
          <dt>Versión</dt>
          <dd>v{subject.versionLabel}</dd>
        </div>
        <div>
          <dt>Firmas como</dt>
          <dd>{subject.requiredRole ?? 'Rol no declarado por el backend'}</dd>
        </div>
        <div>
          <dt>Consecuencia</dt>
          <dd>
            {approving
              ? 'El paso queda firmado y la solicitud avanza en el flujo. No podrás deshacerlo desde el portal.'
              : 'La solicitud se rechaza y la versión no avanza. El artefacto no se modifica.'}
          </dd>
        </div>
      </dl>

      <section className="decision-evidence">
        <h3>Evidencia</h3>
        {!gates.reported ? (
          <p className="decision-warning">
            El backend no envió resultados de gates para esta solicitud. Nadie ha comprobado aquí
            que la compilación, las suites o la cobertura hayan pasado: verifícalo antes de firmar.
          </p>
        ) : (
          <ul className="gate-list">
            {gates.rows.map((gate) => (
              <li key={gate.key} data-passing={isPassingGate(gate.status) ? 'yes' : 'no'}>
                <span>{gate.label}</span>
                <StatusBadge value={gate.status ?? 'SIN DATO'} />
              </li>
            ))}
          </ul>
        )}
        {gates.reported && gates.failing.length ? (
          <p className="decision-warning">
            {gates.failing.length} gate(s) no están en estado aprobado.
          </p>
        ) : null}
        {approving && missingEvidence ? (
          <p className="decision-warning">
            Estás aprobando un despliegue sin evidencia completa. Deja constancia del motivo en el
            comentario.
          </p>
        ) : null}
      </section>

      <section className="decision-evidence">
        <h3>Comentario que quedará en la bitácora</h3>
        <p className="decision-comment">{comments}</p>
      </section>
    </ModalDialog>
  );
}
