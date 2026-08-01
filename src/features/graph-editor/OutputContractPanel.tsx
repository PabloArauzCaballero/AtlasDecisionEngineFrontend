'use client';

import { AlertTriangle, LogOut, Wand2 } from 'lucide-react';
import { asRows, display, type UnknownRecord } from '../../utils/records';
import {
  SENSITIVITY_CLASSES,
  SENSITIVITY_LABELS,
  TRACE_POLICIES,
  TRACE_POLICY_LABELS,
} from '../../contracts/data-types';

interface Props {
  /** Variables del grafo; se usan las declaradas como salida. */
  variables: UnknownRecord[];
  intermediates: UnknownRecord[];
  nodes: UnknownRecord[];
  outputContract: UnknownRecord[];
  onChange: (outputContract: UnknownRecord[]) => void;
}

const SOURCE_KINDS = [
  { value: 'NODE', label: 'Un nodo lo produce' },
  { value: 'INTERMEDIATE', label: 'Se toma de una variable intermedia' },
  { value: 'EXPRESSION', label: 'Se calcula con una expresión' },
  { value: 'CONSTANT', label: 'Valor constante' },
  { value: 'REFERENCE', label: 'Lo devuelve un artefacto referenciado' },
] as const;

/**
 * Contrato de salida explícito (§4): de dónde sale cada campo que el artefacto publica.
 *
 * La salida final no se infiere del último nodo. Declararla aquí es lo que permite al
 * backend comprobar, ANTES de publicar, que todo campo obligatorio tiene origen
 * alcanzable y que ninguna variable intermedia se escapa sin un mapeo explícito.
 */
export function OutputContractPanel({
  variables,
  intermediates,
  nodes,
  outputContract,
  onChange,
}: Props) {
  const outputs = asRows(variables).filter((variable) =>
    String(variable.usageType ?? '').startsWith('OUTPUT'),
  );
  const fields = asRows(outputContract);
  const byCode = new Map(fields.map((field) => [display(field, 'code'), field]));
  const nodeKeys = asRows(nodes)
    .map((node) => display(node, 'key'))
    .filter(Boolean);
  const intermediateCodes = asRows(intermediates).map((item) => display(item, 'code'));

  const upsert = (code: string, change: UnknownRecord) => {
    const existing = byCode.get(code);
    if (existing) {
      onChange(
        fields.map((field) => (display(field, 'code') === code ? { ...field, ...change } : field)),
      );
      return;
    }
    onChange([...fields, { ...defaultField(code, nodeKeys[0] ?? ''), ...change }]);
  };

  const declareAll = () => {
    const missing = outputs
      .map((output) => display(output, 'code'))
      .filter((code) => !byCode.has(code))
      .map((code) => defaultField(code, nodeKeys[0] ?? ''));
    if (missing.length) onChange([...fields, ...missing]);
  };

  const undeclared = outputs.filter((output) => !byCode.has(display(output, 'code')));

  return (
    <section className="output-contract-panel">
      <div className="output-contract-heading">
        <div>
          <strong>
            <span className="io-badge io-out">
              <LogOut size={12} /> Contrato de salida
            </span>{' '}
            Origen de cada resultado
          </strong>
          <small>
            Declara de dónde sale cada campo. Sin esto no se puede comprobar que todos los caminos
            produzcan lo que el artefacto promete.
          </small>
        </div>
        {undeclared.length ? (
          <button className="button" type="button" onClick={declareAll}>
            <Wand2 size={14} aria-hidden /> Declarar las {undeclared.length} que faltan
          </button>
        ) : null}
      </div>

      {!outputs.length ? (
        <small className="field-hint">
          Aún no hay variables de salida declaradas: añádelas antes de definir su origen.
        </small>
      ) : null}

      {undeclared.length ? (
        <p className="contract-warning">
          <AlertTriangle size={14} aria-hidden /> {undeclared.length} salida(s) sin origen
          declarado: {undeclared.map((output) => display(output, 'code')).join(', ')}.
        </p>
      ) : null}

      <ul className="output-contract-list">
        {outputs.map((output) => {
          const code = display(output, 'code');
          const field = byCode.get(code);
          const sourceKind = display(field ?? {}, 'sourceKind') || 'NODE';
          const required = Boolean(output.required);
          return (
            <li key={code} className="output-contract-row">
              <div className="output-contract-row-head">
                <b>{code}</b>
                <small>{display(output, 'dataType')}</small>
                <small>{required ? 'obligatoria' : 'opcional'}</small>
              </div>
              <div className="constraint-grid">
                <label className="constraint-field">
                  <span>Origen</span>
                  <select
                    value={sourceKind}
                    onChange={(event) => upsert(code, { sourceKind: event.target.value })}
                  >
                    {SOURCE_KINDS.map((kind) => (
                      <option key={kind.value} value={kind.value}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="constraint-field">
                  <span>Referencia</span>
                  {sourceKind === 'NODE' || sourceKind === 'REFERENCE' ? (
                    <select
                      value={display(field ?? {}, 'sourceRef')}
                      onChange={(event) => upsert(code, { sourceRef: event.target.value })}
                    >
                      <option value="">— elegir nodo —</option>
                      {nodeKeys.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  ) : sourceKind === 'INTERMEDIATE' ? (
                    <select
                      value={display(field ?? {}, 'sourceRef')}
                      onChange={(event) => upsert(code, { sourceRef: event.target.value })}
                    >
                      <option value="">— elegir intermedia —</option>
                      {intermediateCodes.map((intermediateCode) => (
                        <option key={intermediateCode} value={intermediateCode}>
                          {intermediateCode}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={display(field ?? {}, 'sourceRef')}
                      placeholder={sourceKind === 'CONSTANT' ? 'APROBADO' : 'expresión'}
                      onChange={(event) => upsert(code, { sourceRef: event.target.value })}
                    />
                  )}
                </label>
                <label className="constraint-field">
                  <span>Sensibilidad</span>
                  <select
                    value={display(field ?? {}, 'sensitivityClass') || 'INTERNAL'}
                    onChange={(event) => upsert(code, { sensitivityClass: event.target.value })}
                  >
                    {SENSITIVITY_CLASSES.map((value) => (
                      <option key={value} value={value}>
                        {SENSITIVITY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="constraint-field">
                  <span>En la traza</span>
                  <select
                    value={display(field ?? {}, 'tracePolicy') || 'FULL'}
                    onChange={(event) => upsert(code, { tracePolicy: event.target.value })}
                  >
                    {TRACE_POLICIES.map((value) => (
                      <option key={value} value={value}>
                        {TRACE_POLICY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                {!required ? (
                  <label className="constraint-field constraint-wide">
                    <span>Motivos por los que puede faltar (uno por línea)</span>
                    <textarea
                      rows={2}
                      value={(Array.isArray(field?.absenceReasons) ? field.absenceReasons : [])
                        .map(String)
                        .join('\n')}
                      onChange={(event) =>
                        upsert(code, {
                          absenceReasons: event.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function defaultField(code: string, firstNodeKey: string): UnknownRecord {
  return {
    code,
    name: code,
    description: '',
    sourceKind: 'NODE',
    sourceRef: firstNodeKey,
    absenceReasons: [],
    contractVersion: '1',
    sensitivityClass: 'INTERNAL',
    tracePolicy: 'FULL',
  };
}
