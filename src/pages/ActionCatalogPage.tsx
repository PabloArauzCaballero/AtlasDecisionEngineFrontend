'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { DataTable, type TableColumn } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import {
  bankOptions,
  EMPTY_BANK_FILTERS,
  filterBank,
  type BankEntry,
  type BankFilters,
} from '../features/actions/action-bank';
import { ActionTargetPanel } from '../features/actions/ActionTargetPanel';
import { useActionBank, useActionWrite } from '../features/actions/useActionBank';

const COLUMNS: TableColumn<BankEntry>[] = [
  { key: 'code', label: 'Acción', mono: true },
  { key: 'type', label: 'Tipo', status: true, hint: 'Qué clase de operación ejecuta el motor.' },
  {
    key: 'implies',
    label: 'Qué implica',
    wrap: true,
    hint: 'La consecuencia, en lenguaje de negocio.',
  },
  {
    key: 'algorithms',
    label: 'En algoritmos',
    wrap: true,
    hint: 'Versiones que declaran esta acción. Vacío no existe: toda acción vive en al menos una.',
  },
  {
    key: 'consistency',
    label: 'Coherencia',
    status: true,
    hint: 'DIVERGE = el mismo código está definido de forma distinta en dos algoritmos.',
  },
  // Al detalle desplegable. La tabla se lee de un vistazo con seis columnas; con
  // once hay que desplazarse en horizontal y se pierde de vista qué fila es cuál.
  // Lo que baja aquí es o bien texto largo, o bien algo que «Qué implica» ya
  // resume en palabras. Sigue siendo buscable y ordenable.
  { key: 'reads', label: 'Lee', detail: true, hint: 'Variables que necesita para ejecutarse.' },
  { key: 'writes', label: 'Escribe', mono: true, detail: true },
  { key: 'reasons', label: 'Motivos', mono: true, detail: true },
  {
    key: 'terminal',
    label: 'Continuidad',
    detail: true,
    hint: 'Si después de esta acción el flujo sigue o termina.',
  },
  { key: 'expression', label: 'Cómo lo calcula', detail: true },
  { key: 'usedBy', label: 'La usan', detail: true, hint: 'Pasos que la ejecutan.' },
];

/**
 * Banco de acciones y transformaciones.
 *
 * Es el repertorio de todo lo que las decisiones saben hacer, independiente de
 * cualquier algoritmo: se consulta sin elegir versión y desde aquí una acción se
 * aplica al algoritmo que la necesite.
 *
 * El motor las guarda por versión (`decision_rule_action` es único por versión +
 * código), así que el banco es la unión de todas. Esa forma tiene una
 * consecuencia visible aquí y en ningún otro sitio: el mismo código puede
 * significar cosas distintas según el algoritmo, y la columna «Coherencia» lo
 * señala. Ver `docs/banco-de-acciones.md` para lo que haría falta en el motor
 * para que fuese un recurso de primera clase.
 */
export function ActionCatalogPage() {
  const [filters, setFilters] = useState<BankFilters>(EMPTY_BANK_FILTERS);
  const [editing, setEditing] = useState<BankEntry | null>(null);
  const [open, setOpen] = useState(false);
  const bank = useActionBank();
  const write = useActionWrite();

  const visible = filterBank(bank.entries, filters);
  const options = bankOptions(bank.entries);
  const divergent = bank.entries.filter((entry) => entry.consistency === 'DIVERGE').length;
  const hasFilters = Object.values(filters).some(Boolean);

  const edit = (entry: BankEntry | null) => {
    setEditing(entry);
    setOpen(true);
    write.reset();
  };

  return (
    <>
      <PageHeader
        eyebrow="F2 · Banco"
        title="Acciones y transformaciones"
        description="El repertorio de lo que las decisiones saben hacer: calcular un campo, emitir un motivo o abrir una revisión. Se define una vez y se aplica a los algoritmos que lo necesiten."
        hint="El banco reúne las acciones de todos los algoritmos. Desde cada fila puedes aplicarla a otro algoritmo; asignarla a un paso concreto se hace después en el editor de grafo."
        actions={
          <button className="button button-primary" type="button" onClick={() => edit(null)}>
            <Plus size={16} /> Crear acción
          </button>
        }
      />

      <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>Buscar</span>
          <input
            type="search"
            value={filters.search}
            placeholder="Código, campo, variable o motivo"
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Tipo</span>
          <select
            aria-label="Filtrar acciones por tipo"
            value={filters.type}
            onChange={(event) =>
              setFilters((current) => ({ ...current, type: event.target.value }))
            }
          >
            <option value="">Todos</option>
            {options.types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Algoritmo</span>
          <select
            aria-label="Filtrar acciones por algoritmo"
            value={filters.algorithm}
            onChange={(event) =>
              setFilters((current) => ({ ...current, algorithm: event.target.value }))
            }
          >
            <option value="">Todos</option>
            {options.algorithms.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Uso en el flujo</span>
          <select
            aria-label="Filtrar acciones por uso en el flujo"
            value={filters.usage}
            onChange={(event) =>
              setFilters((current) => ({ ...current, usage: event.target.value }))
            }
          >
            <option value="">Todas</option>
            <option value="usadas">Sólo las que ejecuta algún paso</option>
            <option value="huerfanas">Sólo las que no ejecuta nadie</option>
          </select>
        </label>
        <label>
          <span>Coherencia</span>
          <select
            aria-label="Filtrar acciones por coherencia entre algoritmos"
            value={filters.consistency}
            onChange={(event) =>
              setFilters((current) => ({ ...current, consistency: event.target.value }))
            }
          >
            <option value="">Todas</option>
            <option value="diverge">Sólo las que divergen entre algoritmos</option>
          </select>
        </label>
        {hasFilters ? (
          <button className="button" type="button" onClick={() => setFilters(EMPTY_BANK_FILTERS)}>
            <X size={16} /> Limpiar
          </button>
        ) : null}
      </form>

      {bank.isError ? <Alert tone="error">{errorMessage(bank.error)}</Alert> : null}
      {divergent ? (
        <Alert tone="warning">
          {divergent === 1
            ? 'Una acción está definida de forma distinta según el algoritmo.'
            : `${divergent} acciones están definidas de forma distinta según el algoritmo.`}{' '}
          Filtra por «divergen entre algoritmos» para revisarlas: el mismo nombre debería significar
          siempre lo mismo.
        </Alert>
      ) : null}

      {open ? (
        <Panel title={editing ? `Aplicar ${editing.code}` : 'Nueva acción'}>
          <ActionTargetPanel
            entry={editing}
            versions={bank.versions}
            write={write}
            onClose={() => setOpen(false)}
          />
        </Panel>
      ) : null}

      {bank.isLoading ? (
        <section className="panel">
          <div className="empty-state">Reuniendo las acciones de todos los algoritmos…</div>
        </section>
      ) : bank.entries.length ? (
        <section className="panel">
          <div className="panel-title">
            <span>
              {visible.length} de {bank.entries.length} acciones
            </span>
            <small>{bank.versions.length} algoritmos revisados</small>
          </div>
          <DataTable
            rows={visible}
            columns={COLUMNS}
            getRowKey={(row) => row.code}
            rowActions={(row) => [
              { action: 'edit', label: `Aplicar o editar ${row.code}`, onClick: () => edit(row) },
            ]}
          />
        </section>
      ) : (
        <section className="panel">
          <EmptyState
            illustration="empty"
            title="Todavía no hay ninguna acción"
            description="Sin acciones, los pasos de los algoritmos no pueden calcular campos, emitir motivos ni derivar casos a una persona."
            example="Crea la primera, o genera un algoritmo completo desde código con «Importar código»."
            actions={
              <button className="button button-primary" type="button" onClick={() => edit(null)}>
                <Plus size={16} /> Crear la primera acción
              </button>
            }
          />
        </section>
      )}
    </>
  );
}
