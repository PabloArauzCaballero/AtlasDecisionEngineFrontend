import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../api/http-client';
import { errorMessage } from '../../api/ApiError';
import type { PagedResponse } from '../../resources/resource.types';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  variables: UnknownRecord[];
  onChange: (variables: UnknownRecord[]) => void;
}

export function OutputVariableManager({ variables, onChange }: Props) {
  const client = useQueryClient();
  const [catalogId, setCatalogId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('scoring');
  const [name, setName] = useState('Scoring');
  const [dataType, setDataType] = useState('NUMBER');
  const outputs = variables.filter((item) => String(item.usageType ?? '').startsWith('OUTPUT'));
  const catalog = useQuery({
    queryKey: ['output-variable-catalog'],
    queryFn: () => apiRequest<PagedResponse<UnknownRecord>>('/v1/variables?page=1&pageSize=100'),
  });
  const create = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>('/v1/variables', {
        method: 'POST',
        body: {
          variableCode: code,
          canonicalName: name,
          businessDescription: `Variable de salida ${name}`,
          dataClassification: 'INTERNAL',
          ownerTeam: 'DECISION_ENGINE',
          isSensitive: false,
          initialVersion: {
            dataType,
            nullable: false,
            sources: [],
            validationRules: [],
          },
        },
      }),
    onSuccess: (definition) => {
      client.invalidateQueries({ queryKey: ['output-variable-catalog'] });
      addDefinition(definition);
      setShowCreate(false);
    },
  });

  function addDefinition(definition: UnknownRecord) {
    const latest = asRows(definition.versions)[0];
    if (!latest?.id || !definition.variableCode) return;
    const variableVersionId = String(latest.id);
    const variableCode = String(definition.variableCode);
    if (outputs.some((item) => display(item, 'code') === variableCode)) return;
    const outputType = display(latest, 'dataType').toUpperCase();
    const canBePrimary = !['OBJECT', 'JSON', 'ARRAY', 'LIST'].includes(outputType);
    const hasPrimary = outputs.some((item) => item.usageType === 'OUTPUT_PRIMARY');
    onChange([
      ...variables,
      {
        variableVersionId,
        code: variableCode,
        version: Number(latest.versionNumber ?? 1),
        dataType: display(latest, 'dataType'),
        nullable: Boolean(latest.nullable),
        defaultValue: latest.defaultValueJson,
        validationRules: asRows(latest.validationRules),
        sources: asRows(latest.sources),
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
    const definition = catalog.data?.items.find((item) => display(item, 'id') === catalogId);
    if (definition) addDefinition(asRecord(definition));
  }

  function makePrimary(codeToPromote: string) {
    const selected = outputs.find((item) => display(item, 'code') === codeToPromote);
    if (
      !selected ||
      ['OBJECT', 'JSON', 'ARRAY', 'LIST'].includes(display(selected, 'dataType').toUpperCase())
    )
      return;
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
        (item) =>
          !['OBJECT', 'JSON', 'ARRAY', 'LIST'].includes(display(item, 'dataType').toUpperCase()),
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <section className="output-contract-panel">
      <div className="output-contract-heading">
        <div>
          <strong>Contrato global de resultados</strong>
          <small>Variables de salida tipadas para todo el artefacto</small>
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
          <option value="">Elegir variable del catálogo…</option>
          {(catalog.data?.items ?? []).map((item) => (
            <option key={display(item, 'id')} value={display(item, 'id')}>
              {display(item, 'variableCode')} ·{' '}
              {display(asRows(item.versions)[0] ?? {}, 'dataType')}
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
            const scalar = !['OBJECT', 'JSON', 'ARRAY', 'LIST'].includes(
              display(item, 'dataType').toUpperCase(),
            );
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
                <button
                  type="button"
                  title="Quitar salida"
                  onClick={() => removeOutput(outputCode)}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            );
          })}
        </div>
      </div>
      {showCreate ? (
        <form className="output-create-form" onSubmit={submit}>
          <label>
            <span>Código</span>
            <input
              required
              pattern="[a-zA-Z][a-zA-Z0-9_.-]+"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <label>
            <span>Nombre</span>
            <input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>Tipo</span>
            <select value={dataType} onChange={(event) => setDataType(event.target.value)}>
              <option>NUMBER</option>
              <option>INTEGER</option>
              <option>STRING</option>
              <option>BOOLEAN</option>
              <option>OBJECT</option>
              <option>ARRAY</option>
            </select>
          </label>
          <button className="button button-primary" disabled={create.isPending} type="submit">
            Guardar y elegir
          </button>
          {create.isError ? (
            <small className="field-error">{errorMessage(create.error)}</small>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
