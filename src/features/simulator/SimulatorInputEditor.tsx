'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { JsonTextarea } from '../../components/JsonTextarea';
import { asRows, display, type UnknownRecord } from '../../utils/records';
import { PairsEditor } from './SimulatorPairsEditor';

type View = 'form' | 'json' | 'pairs';

interface Props {
  artifactCode: string;
  value: string;
  onChange: (next: string) => void;
}

const NUMERIC = new Set(['NUMBER', 'INTEGER', 'INT', 'DECIMAL', 'FLOAT']);
const STRUCTURED = new Set(['OBJECT', 'JSON', 'ARRAY', 'LIST']);

/**
 * Dual input editor for the simulator: a typed form generated from the
 * artifact's declared INPUT contract, and a raw JSON view. Both edit the same
 * JSON payload string.
 */
export function SimulatorInputEditor({ artifactCode, value, onChange }: Props) {
  const [view, setView] = useState<View>('json');
  const autoSwitched = useRef(false);
  const contract = useQuery({
    queryKey: ['artifact-input-contract', artifactCode],
    enabled: artifactCode.trim() !== '',
    queryFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/views/artifact-inputs?artifactCode=${encodeURIComponent(artifactCode.trim())}`,
      ),
  });
  const inputs = asRows(contract.data?.variables).filter(
    (variable) => !String(variable.usageType ?? 'INPUT').startsWith('OUTPUT'),
  );

  useEffect(() => {
    if (inputs.length && !autoSwitched.current) {
      autoSwitched.current = true;
      setView('form');
    }
  }, [inputs.length]);

  const parsed = useMemo<Record<string, unknown> | null>(() => {
    try {
      const object: unknown = JSON.parse(value);
      return object && typeof object === 'object' && !Array.isArray(object)
        ? (object as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }, [value]);

  function setField(code: string, nextValue: unknown) {
    if (!parsed) return;
    const next = { ...parsed };
    if (nextValue === undefined) delete next[code];
    else next[code] = nextValue;
    onChange(JSON.stringify(next, null, 2));
  }

  const knownCodes = new Set(inputs.map((variable) => display(variable, 'variableCode')));
  const extraKeys = parsed ? Object.keys(parsed).filter((key) => !knownCodes.has(key)) : [];

  return (
    <div>
      <div className="view-tabs" role="tablist" aria-label="Modo de edición de variables">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'form'}
          onClick={() => setView('form')}
        >
          Formulario
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'pairs'}
          onClick={() => setView('pairs')}
        >
          Atributo-valor
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'json'}
          onClick={() => setView('json')}
        >
          JSON
        </button>
      </div>
      {view === 'pairs' ? (
        parsed === null ? (
          <Alert tone="error">
            El JSON actual es inválido: corrígelo en la vista JSON antes de usar atributo-valor.
          </Alert>
        ) : (
          <PairsEditor
            parsed={parsed}
            onCommit={(next) => onChange(JSON.stringify(next, null, 2))}
          />
        )
      ) : view === 'json' ? (
        <JsonTextarea
          id="variables"
          label="Variables de entrada (JSON)"
          value={value}
          onChange={onChange}
          rows={16}
        />
      ) : (
        <div className="simulator-variable-form">
          {!artifactCode.trim() ? (
            <Alert tone="info">Elige un artefacto para cargar sus variables a considerar.</Alert>
          ) : null}
          {parsed === null ? (
            <Alert tone="error">
              El JSON actual es inválido: corrígelo en la vista JSON antes de usar el formulario.
            </Alert>
          ) : null}
          {artifactCode.trim() && contract.isSuccess && !inputs.length ? (
            <Alert tone="info">
              El artefacto no declara variables de entrada; usa la vista JSON.
            </Alert>
          ) : null}
          {parsed !== null
            ? inputs.map((variable) => {
                const code = display(variable, 'variableCode');
                const dataType = display(variable, 'dataType').toUpperCase();
                const required = Boolean(variable.isRequired);
                const current = parsed[code];
                return (
                  <label className="field" key={code}>
                    <span>
                      {code}
                      {required ? ' *' : ''}
                    </span>
                    <FieldControl
                      dataType={dataType}
                      value={current}
                      onCommit={(next) => setField(code, next)}
                    />
                    <small className="field-meta">
                      {dataType}
                      {variable.canonicalName ? ` · ${display(variable, 'canonicalName')}` : ''}
                    </small>
                  </label>
                );
              })
            : null}
          {extraKeys.length ? (
            <small className="field-meta">
              Campos adicionales fuera del contrato (edítalos en la vista JSON):{' '}
              {extraKeys.join(', ')}
            </small>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FieldControl({
  dataType,
  value,
  onCommit,
}: {
  dataType: string;
  value: unknown;
  onCommit: (next: unknown) => void;
}) {
  if (NUMERIC.has(dataType)) {
    return (
      <input
        type="number"
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          onCommit(raw === '' ? undefined : Number(raw));
        }}
      />
    );
  }
  if (dataType === 'BOOLEAN' || dataType === 'BOOL') {
    return (
      <select
        value={value === true ? 'true' : value === false ? 'false' : ''}
        onChange={(event) => {
          const raw = event.target.value;
          onCommit(raw === '' ? undefined : raw === 'true');
        }}
      >
        <option value="">Sin valor</option>
        <option value="true">Verdadero</option>
        <option value="false">Falso</option>
      </select>
    );
  }
  if (STRUCTURED.has(dataType)) {
    return (
      <textarea
        rows={3}
        className="code-input"
        defaultValue={value === undefined ? '' : JSON.stringify(value, null, 2)}
        onBlur={(event) => {
          const raw = event.target.value.trim();
          if (raw === '') return onCommit(undefined);
          try {
            onCommit(JSON.parse(raw));
          } catch {
            onCommit(raw);
          }
        }}
      />
    );
  }
  return (
    <input
      value={value === undefined || value === null ? '' : String(value)}
      onChange={(event) => {
        const raw = event.target.value;
        onCommit(raw === '' ? undefined : raw);
      }}
    />
  );
}
