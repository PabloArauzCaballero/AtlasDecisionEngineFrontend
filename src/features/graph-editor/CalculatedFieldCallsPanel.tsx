'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Calculator, Trash2 } from 'lucide-react';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { OptionSelect } from '../../components/OptionSelect';
import { CALL_INPUT_SOURCE_HELP, CALL_TARGET_HELP } from './graph-node-help';
import { closedOptions, inputOption } from './graph-editor-help';
import { parseLiteral, uniqueCallKey } from './calculated-call-values';
import { Field } from '../../components/Field';
import { FieldLabel } from '../../components/FieldLabel';

interface Props {
  /** Llamadas ya declaradas por este nodo. */
  calls: UnknownRecord[];
  /** Variables del contrato: posibles orígenes de entrada. */
  inputs: UnknownRecord[];
  /** Intermedias del grafo: posibles orígenes y destinos. */
  intermediates: UnknownRecord[];
  /** Salidas declaradas: posibles destinos. */
  outputs: UnknownRecord[];
  onChange: (calls: UnknownRecord[]) => void;
}

/**
 * Invoca campos calculados desde este nodo (§5.1).
 *
 * Es lo que convierte un campo calculado en algo reutilizable de verdad: sin este panel,
 * el catálogo de campos existiría pero ningún algoritmo podría usarlo, y cada grafo
 * volvería a escribir la misma fórmula.
 *
 * El desplegable solo ofrece versiones aprobadas o publicadas, y el backend vuelve a
 * comprobarlo: la definición ejecutable la resuelve el servidor, nunca este formulario.
 */
export function CalculatedFieldCallsPanel({
  calls,
  inputs,
  intermediates,
  outputs,
  onChange,
}: Props) {
  const [selectedVersionId, setSelectedVersionId] = useState('');

  const catalog = useQuery({
    queryKey: ['calculated-fields', 'usable'],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>('/v1/calculated-fields?pageSize=100', { signal }),
  });
  const fields = asRows(asRecord(catalog.data).items).filter((field) =>
    ['APPROVED', 'PUBLISHED'].includes(display(field, 'status')),
  );

  const detail = useQuery({
    queryKey: ['calculated-field-detail', selectedVersionId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/calculated-fields/${encodeURIComponent(selectedVersionId)}`, {
        signal,
      }),
    enabled: Boolean(selectedVersionId),
  });

  const rows = asRows(calls);

  function addCall() {
    const field = fields.find((item) => display(item, 'id') === selectedVersionId);
    const versions = asRows(asRecord(detail.data).versions).filter((version) =>
      ['APPROVED', 'PUBLISHED'].includes(display(version, 'status')),
    );
    const version = versions[0];
    if (!field || !version) return;
    const callKey = uniqueCallKey(rows, display(field, 'fieldCode'));
    onChange([
      ...rows,
      {
        callKey,
        calculatedFieldVersionId: display(version, 'id'),
        fieldCode: display(field, 'fieldCode'),
        versionNumber: Number(version.versionNumber ?? 1),
        // El mapeo arranca vacío a propósito: obligar a elegir el origen de cada entrada
        // evita enlaces "por nombre" que parecen correctos y no lo son.
        inputMapping: Object.fromEntries(
          asRows(version.inputs).map((input) => [
            display(input, 'id'),
            { source: 'VARIABLE', path: '' },
          ]),
        ),
        targetKind: 'INTERMEDIATE',
        targetCode: intermediates[0] ? display(intermediates[0], 'code') : '',
        contractInputs: asRows(version.inputs).map((input) => ({
          id: display(input, 'id'),
          dataType: display(input, 'dataType'),
          required: Boolean(input.required),
        })),
      },
    ]);
    setSelectedVersionId('');
  }

  const patch = (callKey: string, change: UnknownRecord) =>
    onChange(
      rows.map((row) => (display(row, 'callKey') === callKey ? { ...row, ...change } : row)),
    );

  const patchMapping = (callKey: string, inputId: string, change: UnknownRecord) => {
    const row = rows.find((item) => display(item, 'callKey') === callKey);
    if (!row) return;
    const mapping = asRecord(row.inputMapping);
    patch(callKey, {
      inputMapping: { ...mapping, [inputId]: { ...asRecord(mapping[inputId]), ...change } },
    });
  };

  return (
    <section className="calculated-calls">
      <div className="output-contract-heading">
        <div>
          <strong>
            <Calculator size={14} aria-hidden /> Campos calculados
          </strong>
          <small>
            Fórmulas reutilizables que este paso invoca. El resultado se guarda en una variable
            intermedia o en una salida.
          </small>
        </div>
      </div>

      <div className="output-contract-controls">
        <OptionSelect
          name="calculatedField"
          value={selectedVersionId}
          ariaLabel="Campo calculado a invocar"
          onChange={(value) => setSelectedVersionId(value)}
          placeholder="Elegir campo calculado…"
          options={fields.map((field) => ({
            value: display(field, 'id'),
            label: `${display(field, 'fieldCode')} · ${display(field, 'name')}`,
            description:
              display(field, 'description', 'businessPurpose') !== '—'
                ? display(field, 'description', 'businessPurpose')
                : undefined,
          }))}
        />
        <button
          type="button"
          className="button button-primary"
          disabled={!selectedVersionId || detail.isPending}
          onClick={addCall}
        >
          Invocar
        </button>
      </div>

      {!fields.length && !catalog.isPending ? (
        <small className="field-hint">
          No hay campos calculados aprobados. Publica uno en «Campos calculados» para poder
          invocarlo aquí.
        </small>
      ) : null}

      <ul className="calculated-call-list">
        {rows.map((call) => {
          const callKey = display(call, 'callKey');
          const mapping = asRecord(call.inputMapping);
          const contractInputs = asRows(call.contractInputs);
          return (
            <li key={callKey}>
              <div className="calculated-call-head">
                <b>{display(call, 'fieldCode')}</b>
                <small>v{display(call, 'versionNumber')}</small>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Quitar la llamada ${callKey}`}
                  onClick={() =>
                    onChange(rows.filter((row) => display(row, 'callKey') !== callKey))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="constraint-grid">
                {contractInputs.map((input) => {
                  const inputId = display(input, 'id');
                  const entry = asRecord(mapping[inputId]);
                  const source = display(entry, 'source') || 'VARIABLE';
                  return (
                    <div className="constraint-field" key={inputId}>
                      <FieldLabel
                        label={`${inputId}${input.required ? ' *' : ''} · ${display(input, 'dataType')}`}
                        tooltip={`Entrada «${inputId}» que pide el campo calculado: elige de dónde sale su valor en este algoritmo.`}
                      />
                      <div className="calculated-call-source">
                        <OptionSelect
                          name="callInputSource"
                          value={source}
                          ariaLabel={`Origen de ${inputId}`}
                          onChange={(value) =>
                            patchMapping(callKey, inputId, {
                              source: value,
                              path: '',
                              value: undefined,
                            })
                          }
                          options={closedOptions(
                            [
                              { value: 'VARIABLE', label: 'Variable de entrada' },
                              { value: 'INTERMEDIATE', label: 'Variable intermedia' },
                              { value: 'LITERAL', label: 'Valor fijo' },
                            ],
                            CALL_INPUT_SOURCE_HELP,
                          )}
                        />
                        {source === 'LITERAL' ? (
                          <input
                            aria-label={`Valor fijo de ${inputId}`}
                            value={String(entry.value ?? '')}
                            onChange={(event) =>
                              patchMapping(callKey, inputId, {
                                value: parseLiteral(event.target.value),
                              })
                            }
                          />
                        ) : (
                          <OptionSelect
                            name="callInputPath"
                            value={display(entry, 'path')}
                            ariaLabel={`Variable que alimenta ${inputId}`}
                            onChange={(value) => patchMapping(callKey, inputId, { path: value })}
                            placeholder="— elegir —"
                            options={(source === 'INTERMEDIATE' ? intermediates : inputs).map(
                              inputOption,
                            )}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                <Field
                  className="constraint-field"
                  label="Guardar el resultado en"
                  tooltip="Si el valor calculado queda para los pasos siguientes o sale en la respuesta del algoritmo."
                >
                  <OptionSelect
                    name="callTargetKind"
                    value={display(call, 'targetKind')}
                    onChange={(value) => patch(callKey, { targetKind: value, targetCode: '' })}
                    options={closedOptions(
                      [
                        { value: 'INTERMEDIATE', label: 'Una variable intermedia' },
                        { value: 'OUTPUT', label: 'Una salida del algoritmo' },
                      ],
                      CALL_TARGET_HELP,
                    )}
                  />
                </Field>
                <Field
                  className="constraint-field"
                  label="Destino"
                  tooltip="Variable intermedia o salida concreta donde se escribe el resultado del campo calculado."
                >
                  <OptionSelect
                    name="callTargetCode"
                    value={display(call, 'targetCode')}
                    onChange={(value) => patch(callKey, { targetCode: value })}
                    placeholder="— elegir —"
                    options={(display(call, 'targetKind') === 'OUTPUT'
                      ? outputs
                      : intermediates
                    ).map(inputOption)}
                  />
                </Field>
              </div>
            </li>
          );
        })}
        {!rows.length ? (
          <li>
            <small className="field-hint">Este paso no invoca ningún campo calculado.</small>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
