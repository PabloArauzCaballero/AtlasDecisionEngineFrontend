'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { JsonTextarea } from '../../components/JsonTextarea';
import { isOutput, VariableList } from '../../components/VariableIo';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import type { ImportedCase, ImportField } from './sample-import';
import { FieldControl } from './SimulatorFieldControl';
import { missingRequired, seedPayload } from './simulator-payload';
import { PairsEditor } from './SimulatorPairsEditor';
import { SimulatorSampleBar } from './SimulatorSampleBar';

type View = 'form' | 'json' | 'pairs';

interface Props {
  artifactCode: string;
  environmentCode: string;
  value: string;
  onChange: (next: string) => void;
  /** La tanda generada o importada, para ejecutarla entera y paginar. */
  onCases?: (cases: ImportedCase[]) => void;
  /** Cuál de la tanda se está editando: es el que recibe lo que se teclea. */
  onActiveCase?: (index: number) => void;
}

/**
 * Dual input editor for the simulator: a typed form generated from the
 * artifact's declared INPUT contract, and a raw JSON view. Both edit the same
 * JSON payload string.
 */
export function SimulatorInputEditor({
  artifactCode,
  environmentCode,
  value,
  onChange,
  onCases,
  onActiveCase,
}: Props) {
  const [view, setView] = useState<View>('form');
  const contract = useQuery({
    queryKey: ['artifact-input-contract', artifactCode],
    enabled: artifactCode.trim() !== '',
    queryFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/views/artifact-inputs?artifactCode=${encodeURIComponent(artifactCode.trim())}`,
      ),
  });
  const variables = asRows(contract.data?.variables);
  const inputs = variables.filter((variable) => !isOutput(variable.usageType));
  const outputs = variables.filter((variable) => isOutput(variable.usageType));

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

  // Al elegir un artefacto se siembra el formulario con SUS variables: antes se
  // enviaba siempre el mismo ejemplo fijo y la simulación devolvía NO_DECISION.
  const seededFor = useRef('');
  useEffect(() => {
    const code = artifactCode.trim();
    if (!code || !inputs.length || seededFor.current === code) return;
    seededFor.current = code;
    onChange(JSON.stringify(seedPayload(inputs, parsed), null, 2));
    setView('form');
    // `inputs`/`parsed` se recalculan en cada render; la siembra depende sólo del
    // artefacto y de que su contrato ya haya llegado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactCode, inputs.length]);

  const missing = missingRequired(inputs, parsed);

  function setField(code: string, nextValue: unknown) {
    if (!parsed) return;
    const next = { ...parsed };
    if (nextValue === undefined) delete next[code];
    else next[code] = nextValue;
    onChange(JSON.stringify(next, null, 2));
  }

  const knownCodes = new Set(inputs.map((variable) => display(variable, 'variableCode')));
  const extraKeys = parsed ? Object.keys(parsed).filter((key) => !knownCodes.has(key)) : [];

  const importContract: ImportField[] = inputs.map((variable) => ({
    code: display(variable, 'variableCode'),
    dataType: display(variable, 'dataType'),
    required: Boolean(variable.isRequired),
  }));

  return (
    <div>
      <SimulatorSampleBar
        artifactCode={artifactCode}
        environmentCode={environmentCode}
        contract={importContract}
        // Lo que ya hay escrito, para que cargar un documento lo conserve en vez
        // de vaciar el formulario.
        current={parsed ?? undefined}
        // Mientras el contrato no ha llegado no se sabe dónde entra un
        // documento: aceptar el archivo sólo servía para rechazarlo mal.
        contractLoading={artifactCode.trim() !== '' && contract.isPending}
        onCases={onCases}
        onActive={onActiveCase}
        onLoad={(input) => {
          onChange(JSON.stringify(input, null, 2));
          setView('form');
        }}
      />
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
          {missing.length ? (
            <Alert tone="warning">
              Faltan {missing.length} variables obligatorias para poder decidir:{' '}
              <strong>{missing.join(', ')}</strong>.
            </Alert>
          ) : null}
          {parsed !== null
            ? inputs.map((variable) => {
                const code = display(variable, 'variableCode');
                const dataType = display(variable, 'dataType').toUpperCase();
                const required = Boolean(variable.isRequired);
                const schema = asRecord(variable.validationSchema);
                const allowed = Array.isArray(schema.enum) ? schema.enum : [];
                const current = parsed[code];
                return (
                  <label className="field" key={code}>
                    <span>
                      {code}
                      {required ? ' *' : ''}
                    </span>
                    {allowed.length ? (
                      <select
                        value={current === undefined || current === null ? '' : String(current)}
                        onChange={(event) =>
                          setField(code, event.target.value === '' ? undefined : event.target.value)
                        }
                      >
                        <option value="">Sin valor</option>
                        {allowed.map((option) => (
                          <option key={String(option)} value={String(option)}>
                            {String(option)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <FieldControl
                        dataType={dataType}
                        value={current}
                        onCommit={(next) => setField(code, next)}
                      />
                    )}
                    <small className="field-meta">
                      {dataType}
                      {variable.canonicalName ? ` · ${display(variable, 'canonicalName')}` : ''}
                      {rangeHint(schema)}
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
          {outputs.length ? (
            <VariableList
              title="Salidas que devolverá"
              hint="Resultados que produce esta decisión; no se rellenan aquí."
              tone="out"
              variables={outputs}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Rango admitido de una variable numérica, para que se vea qué es válido. */
function rangeHint(schema: UnknownRecord): string {
  const min = schema.minimum ?? schema.exclusiveMinimum;
  const max = schema.maximum ?? schema.exclusiveMaximum;
  if (typeof min !== 'number' && typeof max !== 'number') return '';
  if (typeof min === 'number' && typeof max === 'number') return ` · entre ${min} y ${max}`;
  return typeof min === 'number' ? ` · mínimo ${min}` : ` · máximo ${max}`;
}
