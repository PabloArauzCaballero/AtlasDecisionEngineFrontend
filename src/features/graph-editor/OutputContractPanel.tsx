'use client';

import { AlertTriangle, LogOut, Wand2 } from 'lucide-react';
import { asRows, display, type UnknownRecord } from '../../utils/records';
import { OutputContractJsonPreview } from './OutputContractJsonPreview';
import { OutputReasonCodesField } from './OutputReasonCodesField';
import { OptionSelect } from '../../components/OptionSelect';
import { OUTPUT_SOURCE_HELP, closedOptions, nodeKeyOptions } from './graph-editor-help';
import { sensitivityOptions, tracePolicyOptions } from '../../contracts/contract-help';
import { Field } from '../../components/Field';

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
                <Field
                  className="constraint-field"
                  label="Origen"
                  tooltip="De dónde sale el valor de este campo de la salida; el motor comprueba antes de publicar que exista."
                >
                  <OptionSelect
                    name="sourceKind"
                    value={sourceKind}
                    onChange={(value) => upsert(code, { sourceKind: value })}
                    options={closedOptions(SOURCE_KINDS, OUTPUT_SOURCE_HELP)}
                  />
                </Field>
                <Field
                  className="constraint-field"
                  label="Referencia"
                  tooltip="El paso o la variable intermedia concreta de la que se toma el valor."
                >
                  {sourceKind === 'NODE' || sourceKind === 'REFERENCE' ? (
                    <OptionSelect
                      name="sourceRef"
                      value={display(field ?? {}, 'sourceRef')}
                      onChange={(value) => upsert(code, { sourceRef: value })}
                      placeholder="— elegir nodo —"
                      options={nodeKeyOptions(nodeKeys)}
                    />
                  ) : sourceKind === 'INTERMEDIATE' ? (
                    <OptionSelect
                      name="sourceRef"
                      value={display(field ?? {}, 'sourceRef')}
                      onChange={(value) => upsert(code, { sourceRef: value })}
                      placeholder="— elegir intermedia —"
                      options={nodeKeyOptions(intermediateCodes)}
                    />
                  ) : (
                    <input
                      value={display(field ?? {}, 'sourceRef')}
                      placeholder={sourceKind === 'CONSTANT' ? 'APROBADO' : 'expresión'}
                      onChange={(event) => upsert(code, { sourceRef: event.target.value })}
                    />
                  )}
                </Field>
                <Field
                  className="constraint-field"
                  label="Sensibilidad"
                  tooltip="Cuánto protege el motor este campo al devolverlo y registrarlo."
                >
                  <OptionSelect
                    name="sensitivityClass"
                    value={display(field ?? {}, 'sensitivityClass') || 'INTERNAL'}
                    onChange={(value) => upsert(code, { sensitivityClass: value })}
                    options={sensitivityOptions()}
                  />
                </Field>
                <Field
                  className="constraint-field"
                  label="En la traza"
                  tooltip="Qué se guarda de este campo en la traza de cada ejecución."
                >
                  <OptionSelect
                    name="tracePolicy"
                    value={display(field ?? {}, 'tracePolicy') || 'FULL'}
                    onChange={(value) => upsert(code, { tracePolicy: value })}
                    options={tracePolicyOptions()}
                  />
                </Field>
                <div className="constraint-field constraint-wide">
                  <OutputReasonCodesField
                    selected={(Array.isArray(field?.reasonCodes) ? field.reasonCodes : []).map(
                      String,
                    )}
                    onChange={(reasonCodes) => upsert(code, { reasonCodes })}
                  />
                </div>
                {!required ? (
                  <Field
                    className="constraint-field constraint-wide"
                    label="Motivos por los que puede faltar (uno por línea)"
                    tooltip="Casos legítimos en que el campo sale vacío. Ej.: SIN_HISTORIAL_CREDITICIO. Sin ellos, un vacío se trata como fallo."
                  >
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
                  </Field>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {outputs.length ? <OutputContractJsonPreview outputs={outputs} fields={fields} /> : null}
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
    reasonCodes: [],
    contractVersion: '1',
    sensitivityClass: 'INTERNAL',
    tracePolicy: 'FULL',
  };
}
