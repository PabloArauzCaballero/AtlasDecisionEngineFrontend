'use client';

import { Plus, Trash2 } from 'lucide-react';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import type { CalculatedFieldInput, OperationArg, OperationNode } from './calculated-field.types';
import { OptionSelect } from '../../components/OptionSelect';

interface Props {
  /** Catálogo de operaciones autorizadas devuelto por el backend. */
  operations: UnknownRecord[];
  inputs: CalculatedFieldInput[];
  value?: OperationNode;
  onChange: (operation: OperationNode | undefined) => void;
}

/**
 * Constructor visual de operaciones (§6.1).
 *
 * Solo permite elegir operaciones del catálogo que publica el backend; no hay campo de
 * texto libre. Eso es lo que hace que esta modalidad sea estructuralmente incapaz de
 * ejecutar código arbitrario, y por eso es la recomendada frente a JS/Python.
 */
export function OperationBuilder({ operations, inputs, value, onChange }: Props) {
  const byCategory = new Map<string, UnknownRecord[]>();
  for (const operation of operations) {
    const category = display(operation, 'category');
    byCategory.set(category, [...(byCategory.get(category) ?? []), operation]);
  }

  if (!value) {
    return (
      <div className="operation-builder">
        <p className="field-hint">
          Elige la operación principal. Cada argumento puede ser otra operación, una entrada o un
          valor fijo.
        </p>
        <OperationPicker
          byCategory={byCategory}
          value=""
          onPick={(operationId) => onChange(newOperation(operationId, operations))}
        />
      </div>
    );
  }

  return (
    <div className="operation-builder">
      <OperationNodeEditor
        node={value}
        operations={operations}
        byCategory={byCategory}
        inputs={inputs}
        depth={0}
        onChange={(next) => onChange(next as OperationNode | undefined)}
      />
    </div>
  );
}

interface NodeEditorProps {
  node: OperationArg;
  operations: UnknownRecord[];
  byCategory: Map<string, UnknownRecord[]>;
  inputs: CalculatedFieldInput[];
  depth: number;
  onChange: (next: OperationArg | undefined) => void;
}

function OperationNodeEditor({
  node,
  operations,
  byCategory,
  inputs,
  depth,
  onChange,
}: NodeEditorProps) {
  const record = asRecord(node as UnknownRecord);
  const kind = 'operation' in record ? 'OPERATION' : 'input' in record ? 'INPUT' : 'LITERAL';
  const definition = operations.find(
    (candidate) => display(candidate, 'id') === String(record.operation ?? ''),
  );

  const changeKind = (nextKind: string) => {
    if (nextKind === 'INPUT') onChange({ input: inputs[0]?.id ?? '' });
    else if (nextKind === 'LITERAL') onChange({ literal: 0 });
    else onChange(newOperation(display(operations[0] ?? {}, 'id'), operations));
  };

  return (
    <div className="operation-node" style={{ marginInlineStart: depth ? 16 : 0 }}>
      <div className="operation-node-head">
        <OptionSelect
          name="tipo-argumento"
          ariaLabel="Tipo de argumento"
          compact
          value={kind}
          onChange={changeKind}
          options={[
            {
              value: 'OPERATION',
              label: 'Operación',
              description: 'Aplica una operación autorizada a sus argumentos.',
            },
            {
              value: 'INPUT',
              label: 'Entrada',
              description: 'Toma el valor de una entrada del campo calculado.',
            },
            {
              value: 'LITERAL',
              label: 'Valor fijo',
              description: 'Usa un valor fijo escrito a mano.',
            },
          ]}
        />

        {kind === 'OPERATION' ? (
          <OperationPicker
            byCategory={byCategory}
            value={String(record.operation ?? '')}
            onPick={(operationId) => onChange(newOperation(operationId, operations))}
          />
        ) : null}

        {kind === 'INPUT' ? (
          <OptionSelect
            name="entrada-argumento"
            ariaLabel="Entrada del campo calculado"
            compact
            value={String(record.input ?? '')}
            onChange={(valor) => onChange({ input: valor })}
            placeholder="— elegir entrada —"
            options={inputs.map((entry) => ({
              value: entry.id, // sin-ayuda: entradas declaradas por el propio campo
              label: entry.id,
            }))}
          />
        ) : null}

        {kind === 'LITERAL' ? (
          <input
            aria-label="Valor fijo"
            value={String(record.literal ?? '')}
            onChange={(event) => onChange({ literal: parseLiteral(event.target.value) })}
          />
        ) : null}

        {depth > 0 ? (
          <button
            type="button"
            className="icon-button"
            aria-label="Quitar argumento"
            onClick={() => onChange(undefined)}
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>

      {definition ? (
        <small className="field-hint">
          {display(definition, 'description')} · {display(definition, 'example')}
        </small>
      ) : null}

      {kind === 'OPERATION' ? (
        <div className="operation-args">
          {asRows(record.args as unknown).map((arg, index) => (
            <OperationNodeEditor
              key={index}
              node={arg as OperationArg}
              operations={operations}
              byCategory={byCategory}
              inputs={inputs}
              depth={depth + 1}
              onChange={(next) => {
                const args = [...asRows(record.args as unknown)] as OperationArg[];
                if (next === undefined) args.splice(index, 1);
                else args[index] = next;
                onChange({ operation: String(record.operation), args });
              }}
            />
          ))}
          {definition?.variadic ? (
            <button
              type="button"
              className="button"
              onClick={() =>
                onChange({
                  operation: String(record.operation),
                  args: [...(asRows(record.args as unknown) as OperationArg[]), { literal: 0 }],
                })
              }
            >
              <Plus size={14} aria-hidden /> Añadir argumento
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OperationPicker({
  byCategory,
  value,
  onPick,
}: {
  byCategory: Map<string, UnknownRecord[]>;
  value: string;
  onPick: (operationId: string) => void;
}) {
  return (
    <OptionSelect
      name="operacion"
      ariaLabel="Operación autorizada"
      compact
      value={value}
      onChange={onPick}
      placeholder="— elegir operación —"
      options={[...byCategory.entries()].flatMap(([category, items]) =>
        items.map((operation) => ({
          value: display(operation, 'id'),
          label: display(operation, 'label'),
          description: `Categoría: ${category}`,
        })),
      )}
    />
  );
}

/** Crea un nodo con tantos argumentos vacíos como exija la operación elegida. */
function newOperation(operationId: string, operations: UnknownRecord[]): OperationNode {
  const definition = operations.find((candidate) => display(candidate, 'id') === operationId);
  const required = asRows(definition?.args).filter((arg) => arg.required).length;
  return {
    operation: operationId,
    args: Array.from({ length: Math.max(required, 1) }, () => ({ literal: 0 })),
  };
}

function parseLiteral(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return raw;
}
