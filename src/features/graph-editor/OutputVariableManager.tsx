import { useMutation, useQuery } from '@tanstack/react-query';
import { LogOut, Plus, Star, Trash2 } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { useState } from 'react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { asRows, display, type UnknownRecord } from '../../utils/records';
import { CatalogVariableForm, type CatalogVariableDraft } from './CatalogVariableForm';

interface Props {
  variables: UnknownRecord[];
  onChange: (variables: UnknownRecord[]) => void;
}

const NON_SCALAR = ['OBJECT', 'JSON', 'ARRAY', 'LIST'];

export function OutputVariableManager({ variables, onChange }: Props) {
  const [catalogId, setCatalogId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const outputs = variables.filter((item) => String(item.usageType ?? '').startsWith('OUTPUT'));

  // Same slim picker the InputVariableManager reads: it exposes `latestVersionId`
  // directly. The full `/v1/variables` list is a flat summary WITHOUT a nested
  // `versions[]`, so reading a version id from it always failed silently — that
  // was the "Añadir salida no funciona" bug.
  const catalog = useQuery({
    queryKey: ['variable-picker'],
    queryFn: () => apiRequest<UnknownRecord[]>('/v1/views/pickers/variables'),
  });
  const pickerRows = asRows(catalog.data);

  const create = useMutation({
    // Nada se rellena por cuenta del portal: equipo, clasificación y descripción
    // los escribe quien crea la variable, porque son justamente lo que el
    // catálogo existe para registrar.
    mutationFn: (draft: CatalogVariableDraft) =>
      apiRequest<UnknownRecord>('/v1/variables', {
        method: 'POST',
        body: {
          variableCode: draft.variableCode.trim(),
          canonicalName: draft.canonicalName.trim(),
          businessDescription: draft.businessDescription.trim(),
          dataClassification: draft.dataClassification.trim(),
          ownerTeam: draft.ownerTeam.trim(),
          isSensitive: false,
          initialVersion: {
            dataType: draft.dataType,
            nullable: false,
            sources: [],
            validationRules: [],
          },
        },
      }),
    onSuccess: async (created) => {
      // The create response is a full definition; the picker is the reliable
      // source of the version id, so refetch it and add the fresh row.
      const refreshed = await catalog.refetch();
      const match = asRows(refreshed.data).find(
        (item) => display(item, 'variableCode') === display(created, 'variableCode'),
      );
      if (match) addFromPicker(match);
      setShowCreate(false);
    },
  });

  function addFromPicker(definition: UnknownRecord) {
    const variableVersionId = display(definition, 'latestVersionId');
    const variableCode = display(definition, 'variableCode');
    if (variableVersionId === '—' || variableCode === '—') return;
    if (outputs.some((item) => display(item, 'code') === variableCode)) return;
    const outputType = display(definition, 'dataType').toUpperCase();
    const canBePrimary = !NON_SCALAR.includes(outputType);
    const hasPrimary = outputs.some((item) => item.usageType === 'OUTPUT_PRIMARY');
    onChange([
      ...variables,
      {
        variableVersionId,
        code: variableCode,
        version: Number(definition.versionNumber ?? 1),
        dataType: display(definition, 'dataType'),
        nullable: Boolean(definition.nullable),
        validationRules: [],
        sources: [],
        required: true,
        fallbackPolicy: 'FAIL_CLOSED',
        sensitive: Boolean(definition.isSensitive),
        usageType: !hasPrimary && canBePrimary ? 'OUTPUT_PRIMARY' : 'OUTPUT',
        dependencyPath: `output.${variableCode}`,
      },
    ]);
    setCatalogId('');
  }

  function addSelected() {
    const definition = pickerRows.find((item) => display(item, 'definitionId') === catalogId);
    if (definition) addFromPicker(definition);
  }

  function makePrimary(codeToPromote: string) {
    const selected = outputs.find((item) => display(item, 'code') === codeToPromote);
    if (!selected || NON_SCALAR.includes(display(selected, 'dataType').toUpperCase())) return;
    onChange(
      variables.map((item) =>
        String(item.usageType ?? '').startsWith('OUTPUT')
          ? {
              ...item,
              usageType: display(item, 'code') === codeToPromote ? 'OUTPUT_PRIMARY' : 'OUTPUT',
            }
          : item,
      ),
    );
  }

  function removeOutput(codeToRemove: string) {
    const next = variables.filter(
      (item) =>
        !(
          String(item.usageType ?? '').startsWith('OUTPUT') &&
          display(item, 'code') === codeToRemove
        ),
    );
    const remaining = next.filter((item) => String(item.usageType ?? '').startsWith('OUTPUT'));
    if (remaining.length && !remaining.some((item) => item.usageType === 'OUTPUT_PRIMARY')) {
      const firstScalar = remaining.find(
        (item) => !NON_SCALAR.includes(display(item, 'dataType').toUpperCase()),
      );
      const firstCode = firstScalar ? display(firstScalar, 'code') : '';
      onChange(
        next.map((item) =>
          firstCode && display(item, 'code') === firstCode
            ? { ...item, usageType: 'OUTPUT_PRIMARY' }
            : item,
        ),
      );
    } else {
      onChange(next);
    }
  }

  return (
    <section className="output-contract-panel">
      <div className="output-contract-heading">
        <div>
          <strong>
            <span className="io-badge io-out">
              <LogOut size={12} /> Salidas
            </span>{' '}
            Contrato global de resultados
          </strong>
          <small>Resultados que SALEN de la decisión (lo que devuelve al resto del sistema).</small>
        </div>
        <button className="button" type="button" onClick={() => setShowCreate((value) => !value)}>
          <Plus size={14} /> Crear variable
        </button>
      </div>
      <div className="output-contract-controls">
        <select
          aria-label="Variable del catálogo para añadir como salida"
          value={catalogId}
          onChange={(event) => setCatalogId(event.target.value)}
        >
          <option value="">
            {catalog.isError ? 'Catálogo no disponible' : 'Elegir variable del catálogo…'}
          </option>
          {pickerRows.map((item) => (
            <option key={display(item, 'definitionId')} value={display(item, 'definitionId')}>
              {display(item, 'variableCode')} · {display(item, 'dataType')}
            </option>
          ))}
        </select>
        <button
          className="button button-primary"
          type="button"
          disabled={!catalogId}
          onClick={addSelected}
        >
          Añadir salida
        </button>
        <div className="output-chips">
          {outputs.map((item) => {
            const outputCode = display(item, 'code');
            const primary = item.usageType === 'OUTPUT_PRIMARY';
            const scalar = !NON_SCALAR.includes(display(item, 'dataType').toUpperCase());
            return (
              <span className={primary ? 'output-chip primary' : 'output-chip'} key={outputCode}>
                <button
                  type="button"
                  disabled={!scalar}
                  title={
                    scalar
                      ? 'Marcar como resultado principal'
                      : 'Sólo una salida escalar puede ser principal'
                  }
                  onClick={() => makePrimary(outputCode)}
                >
                  <Star size={12} fill={primary ? 'currentColor' : 'none'} />
                </button>
                <b>{outputCode}</b>
                <small>{display(item, 'dataType')}</small>
                <ConfirmButton
                  className=""
                  label={`Quitar la salida ${outputCode}`}
                  title={`¿Quitar «${outputCode}» del contrato de resultado?`}
                  confirmLabel="Quitar la salida"
                  description={
                    <p>
                      La decisión dejará de devolver este valor a quien la llame.
                      {primary
                        ? ' Es el resultado principal: se promoverá otra salida escalar en su lugar.'
                        : ''}
                    </p>
                  }
                  onConfirm={() => removeOutput(outputCode)}
                >
                  <Trash2 size={12} />
                </ConfirmButton>
              </span>
            );
          })}
          {!outputs.length ? (
            <small className="field-hint">
              Sin variables de salida: la decisión no devolverá ningún valor. Añade al menos una.
            </small>
          ) : null}
        </div>
      </div>
      {showCreate ? (
        <CatalogVariableForm
          pending={create.isPending}
          error={create.isError ? errorMessage(create.error) : null}
          onSubmit={(draft) => create.mutate(draft)}
        />
      ) : null}
    </section>
  );
}
