import { formatDateTime } from '../../config/locale';
import { StatusBadge } from '../../components/StatusBadge';
import { asRows, display, type UnknownRecord } from '../../utils/records';
import { stepSignatures } from './decision-policy';

interface ApprovalStepsListProps {
  request: UnknownRecord;
}

/**
 * Los pasos de una solicitud, en orden, con QUIÉN firmó cada uno.
 *
 * Sin el firmante, la doble firma no se puede auditar desde el portal: dos pasos APPROVED
 * parecen dos personas aunque los haya firmado la misma.
 */
export function ApprovalStepsList({ request }: ApprovalStepsListProps) {
  const steps = [...asRows(request.steps)].sort(
    (a, b) => Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0),
  );
  return (
    <div className="approval-steps">
      {steps.map((step) => {
        const signatures = stepSignatures(step);
        return (
          <div key={display(step, 'id')}>
            <span>{display(step, 'stepOrder')}</span>
            <div>
              <strong>{display(step, 'requiredRole')}</strong>
              <StatusBadge value={step.status} />
              {signatures.length ? (
                signatures.map((signature, index) => (
                  <p className="muted-text" key={`${signature.decidedBy}-${index}`}>
                    Firmó {signature.decidedBy} ({signature.decision})
                    {signature.decidedAt ? ` · ${formatDateTime(signature.decidedAt)}` : ''}
                  </p>
                ))
              ) : (
                <p className="muted-text">Sin firma todavía</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
