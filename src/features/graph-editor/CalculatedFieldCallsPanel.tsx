'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Calculator, Trash2 } from 'lucide-react';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

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
        <select
          aria-label="Campo calculado a invocar"
          value={selectedVersionId}
          onChange={(event) => setSelectedVersionId(event.target.value)}
        >
          <option value="">Elegir campo calculado…</option>
          {fields.map((field) => (
            <option key={display(field, 'id')} value={display(field, 'id')}>
              {display(field, 'fieldCode')} · {display(field, 'name')}
            </option>
          ))}
        </select>
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
                    <label className="constraint-field" key={inputId}>
                      <span>
                        {inputId}
                        {input.required ? ' *' : ''} · {display(input, 'dataType')}
                      </span>
                      <div className="calculated-call-source">
                        <select
                          aria-label={`Origen de ${inputId}`}
                          value={source}
                          onChange={(event) =>
                            patchMapping(callKey, inputId, {
                              source: event.target.value,
                              path: '',
                              value: undefined,
                            })
                          }
                        >
                          <option value="VARIABLE">Variable de entrada</option>
                          <option value="INTERMEDIATE">Variable intermedia</option>
                          <option value="LITERAL">Valor fijo</option>
                        </select>
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
                          <select
                            aria-label={`Variable que alimenta ${inputId}`}
                            value={display(entry, 'path')}
                            onChange={(event) =>
                              patchMapping(callKey, inputId, { path: event.target.value })
                            }
                          >
                            <option value="">— elegir —</option>
                            {(source === 'INTERMEDIATE' ? intermediates : inputs).map((option) => (
                              <option key={display(option, 'code')} value={display(option, 'code')}>
                                {display(option, 'code')}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </label>
                  );
                })}

                <label className="constraint-field">
                  <span>Guardar el resultado en</span>
                  <select
                    value={display(call, 'targetKind')}
                    onChange={(event) =>
                      patch(callKey, { targetKind: event.target.value, targetCode: '' })
                    }
                  >
                    <option value="INTERMEDIATE">Una variable intermedia</option>
                    <option value="OUTPUT">Una salida del algoritmo</option>
                  </select>
                </label>
                <label className="constraint-field">
                  <span>Destino</span>
                  <select
                    value={display(call, 'targetCode')}
                    onChange={(event) => patch(callKey, { targetCode: event.target.value })}
                  >
                    <option value="">— elegir —</option>
                    {(display(call, 'targetKind') === 'OUTPUT' ? outputs : intermediates).map(
                      (option) => (
                        <option key={display(option, 'code')} value={display(option, 'code')}>
                          {display(option, 'code')}
                        </option>
                      ),
                    )}
                  </select>
                </label>
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

/** Clave estable y única dentro del nodo, derivada del código del campo. */
function uniqueCallKey(existing: UnknownRecord[], fieldCode: string): string {
  const base = fieldCode.replace(/[^a-zA-Z0-9_]/g, '_') || 'llamada';
  let candidate = base;
  let index = 2;
  while (existing.some((row) => display(row, 'callKey') === candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  return candidate;
}

function parseLiteral(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return raw;
}
