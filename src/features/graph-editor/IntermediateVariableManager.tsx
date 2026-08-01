'use client';

import { useState } from 'react';
import { Trash2, Workflow } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { asRows, display, type UnknownRecord } from '../../utils/records';
import { DATA_TYPES, DATA_TYPE_LABELS, normalizeDataType } from '../../contracts/data-types';
import { IntermediateVariableForm } from './IntermediateVariableForm';

interface Props {
  intermediates: UnknownRecord[];
  nodes: UnknownRecord[];
  onChange: (intermediates: UnknownRecord[]) => void;
}

/**
 * Declara las variables INTERMEDIAS del grafo (§2).
 *
 * No salen del catálogo global a propósito: una intermedia solo existe dentro de este
 * grafo y durante una ejecución, así que se declara aquí, junto al grafo que la crea, y
 * nunca aparece en el catálogo de variables reutilizables.
 */
export function IntermediateVariableManager({ intermediates, nodes, onChange }: Props) {
  const [draftCode, setDraftCode] = useState('');
  const [editing, setEditing] = useState('');
  const rows = asRows(intermediates);
  const nodeKeys = nodes.map((node) => display(node, 'key')).filter(Boolean);

  function addIntermediate() {
    const code = draftCode.trim();
    if (!code || rows.some((item) => display(item, 'code') === code)) return;
    onChange([
      ...rows,
      {
        code,
        name: code,
        description: 'Valor temporal calculado durante la ejecución.',
        dataType: 'DECIMAL',
        producerNodeKey: nodeKeys[0] ?? '',
        consumerNodeKeys: [],
        nullable: false,
        updatePolicy: 'SINGLE_WRITE',
        sensitivityClass: 'INTERNAL',
        tracePolicy: 'FULL',
      },
    ]);
    setDraftCode('');
    setEditing(code);
  }

  function patch(code: string, change: UnknownRecord) {
    onChange(rows.map((item) => (display(item, 'code') === code ? { ...item, ...change } : item)));
  }

  function remove(code: string) {
    onChange(rows.filter((item) => display(item, 'code') !== code));
    if (editing === code) setEditing('');
  }

  return (
    <section className="output-contract-panel intermediate-contract-panel">
      <div className="output-contract-heading">
        <div>
          <strong>
            <span className="io-badge io-mid">
              <Workflow size={12} /> Intermedias
            </span>{' '}
            Valores temporales del grafo
          </strong>
          <small>
            Existen solo durante una ejecución. No se piden al cliente ni se devuelven, salvo que un
            campo del contrato de salida las mapee explícitamente.
          </small>
        </div>
      </div>

      <div className="output-contract-controls">
        <input
          aria-label="Código de la nueva variable intermedia"
          placeholder="dti, puntaje_parcial…"
          value={draftCode}
          onChange={(event) => setDraftCode(event.target.value)}
        />
        <button
          className="button button-primary"
          type="button"
          disabled={!draftCode.trim() || !nodeKeys.length}
          onClick={addIntermediate}
        >
          Añadir intermedia
        </button>
      </div>

      {!nodeKeys.length ? (
        <small className="field-hint">
          Añade primero un nodo: toda intermedia necesita un nodo que la cree.
        </small>
      ) : null}

      <ul className="intermediate-list">
        {rows.map((item) => {
          const code = display(item, 'code');
          const isEditing = editing === code;
          return (
            <li key={code} className="intermediate-item">
              <div className="intermediate-summary">
                <button
                  type="button"
                  className="intermediate-toggle"
                  onClick={() => setEditing(isEditing ? '' : code)}
                  aria-expanded={isEditing}
                >
                  <b>{code}</b>
                  <small>{DATA_TYPE_LABELS[normalizeDataType(item.dataType)]}</small>
                  <small className="intermediate-producer">
                    la crea {display(item, 'producerNodeKey') || '— sin nodo —'}
                  </small>
                </button>
                <ConfirmButton
                  className=""
                  label={`Quitar la intermedia ${code}`}
                  title={`¿Quitar «${code}»?`}
                  confirmLabel="Quitar la intermedia"
                  description={
                    <p>
                      Los nodos que la lean se quedarán sin valor y la validación del grafo fallará
                      hasta que quites también esas referencias.
                    </p>
                  }
                  onConfirm={() => remove(code)}
                >
                  <Trash2 size={12} />
                </ConfirmButton>
              </div>
              {isEditing ? (
                <IntermediateVariableForm
                  intermediate={item}
                  nodeKeys={nodeKeys}
                  dataTypes={DATA_TYPES}
                  onPatch={(change) => patch(code, change)}
                />
              ) : null}
            </li>
          );
        })}
        {!rows.length ? (
          <li>
            <small className="field-hint">
              Sin variables intermedias. Añade una cuando un cálculo se use en más de un nodo y no
              deba salir en la respuesta.
            </small>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
