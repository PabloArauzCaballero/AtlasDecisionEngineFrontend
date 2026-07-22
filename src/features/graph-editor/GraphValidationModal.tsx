'use client';

import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { errorMessage } from '../../api/ApiError';
import { ModalDialog } from '../../components/ModalDialog';
import { asRecord, asRows, display } from '../../utils/records';

interface GraphValidationModalProps {
  isPending: boolean;
  data: unknown;
  error: unknown;
  onClose: () => void;
}

/**
 * Structured validation report for the graph editor. Turns the raw validate
 * response (or a request error) into a readable list of blocking errors and
 * warnings, each tied to the offending node/edge/condition.
 */
export function GraphValidationModal({
  isPending,
  data,
  error,
  onClose,
}: GraphValidationModalProps) {
  const report = asRecord(data);
  const errors = asRows(report.errors);
  const warnings = asRows(report.warnings);
  const valid = Boolean(report.valid) && !error;
  const tone = valid && !error ? 'default' : 'danger';

  return (
    <ModalDialog
      title="Resultado de validación"
      subtitle={
        isPending
          ? 'Analizando el algoritmo…'
          : valid
            ? 'Sin errores bloqueantes'
            : 'Se encontraron problemas'
      }
      tone={tone}
      icon={valid ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
      onClose={onClose}
      actions={
        <button type="button" className="button button-primary" onClick={onClose}>
          Entendido
        </button>
      }
    >
      {isPending ? <p>Ejecutando validación estructural y de determinismo…</p> : null}
      {error ? (
        <p className="validation-issue-list">
          <span>{errorMessage(error)}</span>
        </p>
      ) : null}
      {!isPending && !error && valid ? (
        <p className="validation-ok">
          <CheckCircle2 size={16} /> El algoritmo es válido y determinista. Ya puedes compilarlo.
        </p>
      ) : null}
      {!error && (errors.length || warnings.length) ? (
        <ul className="validation-issue-list">
          {errors.map((issue, index) => (
            <li key={`error-${index}`}>
              <strong>{display(issue, 'code')}</strong>
              <span>
                {display(issue, 'message')}
                {issue.entityKey ? (
                  <small>
                    {display(issue, 'entityType', 'ENTIDAD')} · {display(issue, 'entityKey')}
                  </small>
                ) : null}
              </span>
            </li>
          ))}
          {warnings.map((issue, index) => (
            <li className="warning" key={`warning-${index}`}>
              <strong>{display(issue, 'code')}</strong>
              <span>
                {display(issue, 'message')}
                {issue.entityKey ? (
                  <small>
                    {display(issue, 'entityType', 'ENTIDAD')} · {display(issue, 'entityKey')}
                  </small>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </ModalDialog>
  );
}
