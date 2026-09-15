'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import {
  DATA_TYPES,
  DATA_TYPE_LABELS,
  SENSITIVITY_CLASSES,
  SENSITIVITY_LABELS,
} from '../../contracts/data-types';
import { ConstraintEditor } from '../graph-editor/ConstraintEditor';
import {
  emptyContractDraft,
  toPayload,
  type VariableContractDraft,
} from './variable-contract.draft';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';
import { DATA_TYPE_HELP, SENSITIVITY_HELP } from '../../contracts/contract-help';
import { EXPECTED_ORIGIN_HELP } from '../../resources/resource-option-help';

export { emptyContractDraft, toPayload };
export type { VariableContractDraft };

interface Props {
  /** Definición existente; si falta, se está creando la variable. */
  definitionId?: string;
  draft: VariableContractDraft;
  onChange: (draft: VariableContractDraft) => void;
}

const ORIGINS = [
  { value: 'REQUEST', label: 'Llega en la petición' },
  { value: 'PROVIDER', label: 'La resuelve un proveedor externo' },
  { value: 'DERIVED', label: 'La produce el motor' },
  { value: 'CALCULATED_FIELD', label: 'La produce un campo calculado' },
  { value: 'GRAPH_NODE', label: 'La produce un nodo del grafo' },
];

/**
 * Configura el contrato completo de una variable (§1.1) y lo valida contra el backend
 * ANTES de guardarlo (§1.2).
 *
 * Una versión de variable es inmutable en cuanto un artefacto la usa, así que descubrir
 * que el contrato estaba mal al publicar es descubrirlo tarde. Por eso el botón de
 * validar habla con el servidor: comprueba las restricciones, ejecuta los ejemplos
 * declarados y, si la variable ya existe, dice si el cambio rompe a quien la usa.
 */
export function VariableContractEditor({ definitionId, draft, onChange }: Props) {
  const [report, setReport] = useState<UnknownRecord | null>(null);
  const [compatibility, setCompatibility] = useState<UnknownRecord | null>(null);

  const patch = (change: Partial<VariableContractDraft>) => {
    onChange({ ...draft, ...change });
    setReport(null);
    setCompatibility(null);
  };

  const validate = useMutation({
    mutationFn: async () => {
      const body = toPayload(draft);
      const contract = await apiRequest<UnknownRecord>('/v1/variables/validate-contract', {
        method: 'POST',
        body,
      });
      const compat = definitionId
        ? await apiRequest<UnknownRecord>(
            `/v1/variables/${encodeURIComponent(definitionId)}/compatibility`,
            { method: 'POST', body },
          )
        : null;
      return { contract, compat };
    },
    onSuccess: ({ contract, compat }) => {
      setReport(contract);
      setCompatibility(compat);
    },
  });

  const issues = asRows(asRecord(report).issues);
  const samples = asRows(asRecord(report).samples);
  const changes = asRows(asRecord(compatibility).changes);
  const level = display(asRecord(compatibility), 'level');

  return (
    <div className="variable-contract-editor">
      <div className="constraint-grid">
        <Field
          className="constraint-field"
          label={'Tipo de dato'}
          tooltip="Tipo de valor que admite la variable; el motor valida cada entrada contra él."
        >
          <OptionSelect
            name="tipo-dato"
            value={draft.dataType}
            onChange={(valor) => patch({ dataType: valor })}
            options={DATA_TYPES.map((type) => ({
              value: type,
              label: DATA_TYPE_LABELS[type],
              description: DATA_TYPE_HELP[type],
            }))}
          />
        </Field>
        <Field
          className="constraint-field"
          label="Nombre visible"
          tooltip="Nombre legible de la variable en el portal."
        >
          <input
            value={draft.displayName}
            onChange={(event) => patch({ displayName: event.target.value })}
          />
        </Field>
        <Field
          className="constraint-field"
          label={'Origen esperado'}
          tooltip="De dónde se espera que llegue el valor de la variable."
        >
          <OptionSelect
            name="origen-esperado"
            value={draft.expectedOrigin}
            onChange={(valor) => patch({ expectedOrigin: valor })}
            options={ORIGINS.map((origin) => ({
              value: origin.value,
              label: origin.label,
              description: EXPECTED_ORIGIN_HELP[origin.value],
            }))}
          />
        </Field>
        <Field
          className="constraint-field"
          label={'Clasificación de sensibilidad'}
          tooltip="Qué tan sensible es el dato; decide cómo se enmascara y se conserva."
        >
          <OptionSelect
            name="sensibilidad"
            value={draft.sensitivityClass}
            onChange={(valor) => patch({ sensitivityClass: valor })}
            options={SENSITIVITY_CLASSES.map((value) => ({
              value,
              label: SENSITIVITY_LABELS[value],
              description: SENSITIVITY_HELP[value],
            }))}
          />
        </Field>
        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={draft.nullable}
            onChange={(event) => patch({ nullable: event.target.checked })}
          />
          <span>Admite quedarse sin valor</span>
        </label>
        <Field
          className="constraint-field constraint-wide"
          label="Descripción"
          tooltip="Qué representa la variable y de dónde sale."
        >
          <textarea
            rows={2}
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </Field>
        <Field
          className="constraint-field constraint-wide"
          label="Mensaje cuando el valor no cumple el contrato"
          tooltip="Texto que recibe quien envía un valor fuera del contrato."
        >
          <input
            placeholder="El ingreso mensual debe ser mayor que cero"
            value={draft.validationMessage}
            onChange={(event) => patch({ validationMessage: event.target.value })}
          />
        </Field>
        <Field
          className="constraint-field"
          label="Ejemplo válido"
          tooltip="Un valor que cumple el contrato, para probarlo."
        >
          <input
            value={draft.exampleValid}
            onChange={(event) => patch({ exampleValid: event.target.value })}
          />
        </Field>
        <Field
          className="constraint-field"
          label="Ejemplo inválido"
          tooltip="Un valor que el contrato debe rechazar, para probarlo."
        >
          <input
            value={draft.exampleInvalid}
            onChange={(event) => patch({ exampleInvalid: event.target.value })}
          />
        </Field>
      </div>

      <details open>
        <summary>Restricciones</summary>
        <ConstraintEditor
          dataType={draft.dataType}
          constraints={draft.constraints}
          onChange={(constraints) => patch({ constraints })}
        />
      </details>

      <div className="panel-actions">
        <button
          type="button"
          className="button"
          disabled={validate.isPending}
          onClick={() => validate.mutate()}
        >
          {validate.isPending ? 'Validando…' : 'Validar contrato en el servidor'}
        </button>
      </div>

      {validate.isError ? (
        <p className="constraint-result constraint-invalid">
          <XCircle size={14} aria-hidden /> {errorMessage(validate.error)}
        </p>
      ) : null}

      {report ? (
        <div className="contract-report">
          {issues.length ? (
            <ul className="node-state-errors">
              {issues.map((issue, index) => (
                <li key={index}>
                  <code>{display(issue, 'code')}</code> {display(issue, 'message')}
                </li>
              ))}
            </ul>
          ) : (
            <p className="constraint-result constraint-valid">
              <CheckCircle2 size={14} aria-hidden /> El contrato es coherente.
            </p>
          )}
          {samples.length ? (
            <ul className="contract-samples">
              {samples.map((sample, index) => (
                <li key={index} className={sample.valid ? 'is-pass' : 'is-fail'}>
                  <code>{JSON.stringify(sample.value)}</code>{' '}
                  {sample.valid
                    ? 'aceptado'
                    : `rechazado: ${asRows(sample.errors).length ? '' : ''}${(Array.isArray(sample.errors) ? sample.errors : []).join('; ')}`}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {compatibility ? (
        <div className={`contract-compat compat-${level.toLowerCase()}`}>
          <p>
            {level === 'BREAKING' ? (
              <ShieldAlert size={14} aria-hidden />
            ) : level === 'WIDENING' ? (
              <AlertTriangle size={14} aria-hidden />
            ) : (
              <CheckCircle2 size={14} aria-hidden />
            )}{' '}
            {level === 'BREAKING'
              ? 'Cambio incompatible: datos hoy válidos dejarían de serlo.'
              : level === 'WIDENING'
                ? 'Cambio que relaja el contrato: es compatible hacia atrás.'
                : 'Sin cambios que afecten a quien ya usa la variable.'}
          </p>
          {changes.length ? (
            <ul>
              {changes.map((change, index) => (
                <li key={index}>
                  <code>{display(change, 'code')}</code> {display(change, 'message')}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
