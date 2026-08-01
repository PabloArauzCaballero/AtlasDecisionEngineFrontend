'use client';

import { ChevronDown, ChevronRight, Plus, Trash2, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { InfoHint } from '../../components/InfoHint';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { ActionForm } from './ActionForm';
import { astToText, astVariables, shortVariable } from './json-ast';
import { actionMeaning } from './node-io';

interface Props {
  actions: UnknownRecord[];
  nodes: UnknownRecord[];
  onChange: (actions: UnknownRecord[]) => void;
}

/** Nodos que ejecutan una acción, por su código. */
function usedBy(code: string, nodes: UnknownRecord[]): string[] {
  return nodes
    .filter((node) =>
      asRows(node.actions).some((binding) => display(binding, 'actionCode', 'code') === code),
    )
    .map((node) => display(node, 'label', 'key'));
}

/**
 * Catálogo de ACCIONES de la versión.
 *
 * Las acciones son lo que el algoritmo *hace* cuando llega a un paso: calcular
 * un campo, emitir un motivo, abrir una revisión. Vivían sólo dentro del JSON
 * del grafo, así que no había forma de ver cuántas hay, qué implican ni quién
 * las usa. Este panel las lista igual que los catálogos de entradas y salidas, y
 * permite crearlas sin salir del editor.
 */
export function ActionCatalogPanel({ actions, nodes, onChange }: Props) {
  // Cerrado por defecto: una versión real del motor trae decenas de acciones y
  // desplegarlas todas empujaba el lienzo fuera de la pantalla.
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? actions.filter((action) =>
        `${display(action, 'code')} ${display(action, 'type')}`.toLowerCase().includes(needle),
      )
    : actions;

  const remove = (code: string) =>
    onChange(actions.filter((action) => display(action, 'code') !== code));

  return (
    <section className="action-catalog" data-tutorial-id="graph-actions">
      <header>
        <button
          type="button"
          className="action-catalog-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <Zap size={14} aria-hidden="true" />
          <strong>Acciones</strong>
          <span>{actions.length}</span>
        </button>
        <p>
          Lo que el algoritmo <b>hace</b> al llegar a un paso: calcular un campo, emitir un motivo o
          abrir una revisión.
          <InfoHint text="Una acción se define una vez y se reutiliza en los pasos que la necesiten. Un mismo paso puede ejecutar varias en orden." />
        </p>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setCreating((value) => !value)}
        >
          <Plus size={15} /> Crear acción
        </button>
      </header>

      {creating ? (
        <ActionForm
          onCancel={() => setCreating(false)}
          onCreate={(action) => {
            onChange([...actions, action]);
            setCreating(false);
          }}
        />
      ) : null}

      {open ? (
        <>
          {actions.length > 6 ? (
            <input
              className="action-catalog-search"
              type="search"
              value={query}
              aria-label="Buscar una acción por código o tipo"
              placeholder={`Buscar entre ${actions.length} acciones…`}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}
          <div className="action-catalog-list">
            {visible.length ? (
              visible.map((action) => {
                const code = display(action, 'code');
                const payload = asRecord(action.payload);
                const reads = astVariables(payload).map(shortVariable);
                const reasons = asRows(action.reasonCodes);
                const users = usedBy(code, nodes);
                return (
                  <article key={code} className="action-card">
                    <header>
                      <strong>{code}</strong>
                      <span className="action-type">{display(action, 'type')}</span>
                      {action.terminal ? (
                        <span className="action-terminal">cierra el flujo</span>
                      ) : null}
                      <ConfirmButton
                        className="icon-button"
                        label={`Eliminar la acción ${code}`}
                        title={`¿Eliminar la acción ${code}?`}
                        confirmLabel="Eliminar la acción"
                        description={
                          <>
                            <p>{actionMeaning(action)}.</p>
                            {users.length ? (
                              <p>
                                <b>La ejecutan {users.length} pasos:</b> {users.join(', ')}. Se
                                quedarán sin ella y dejarán de hacer eso.
                              </p>
                            ) : (
                              <p>Ningún paso la ejecuta, así que ninguna decisión cambia.</p>
                            )}
                          </>
                        }
                        onConfirm={() => remove(code)}
                      >
                        <Trash2 size={14} />
                      </ConfirmButton>
                    </header>
                    <p className="action-implies">{actionMeaning(action)}</p>
                    {payload.valueExpression ? (
                      <p className="action-expression">
                        <b>Calcula:</b> {astToText(payload.valueExpression)}
                      </p>
                    ) : null}
                    <dl className="action-facts">
                      <div>
                        <dt>Lee</dt>
                        <dd>{reads.length ? reads.join(', ') : 'nada'}</dd>
                      </div>
                      <div>
                        <dt>Escribe</dt>
                        <dd>
                          {display(payload, 'field') !== '—' ? display(payload, 'field') : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Motivos</dt>
                        <dd>
                          {reasons.length
                            ? reasons.map((reason) => display(reason, 'code')).join(', ')
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>La usan</dt>
                        <dd>{users.length ? users.join(', ') : 'ningún paso todavía'}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })
            ) : actions.length ? (
              <p className="action-catalog-empty">Ninguna acción coincide con «{query}».</p>
            ) : (
              <p className="action-catalog-empty">
                Esta versión todavía no declara acciones. Créalas aquí, o genéralas a partir de
                código con <Link href="/code-import">Importar código</Link>, que traduce JavaScript
                o Python a un árbol de decisión completo.
              </p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
