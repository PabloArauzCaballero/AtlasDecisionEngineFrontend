'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { Panel } from '../../components/Panel';
import type { UnknownRecord } from '../../utils/records';
import { diffGraphs, groupByCollection, type DiffEntry } from './version-diff';

export interface DiffBase {
  versionId: string;
  label: string;
  /** Por qué esta comparación importa, p. ej. «lo que hoy decide en PROD». */
  hint?: string;
}

interface VersionDiffPanelProps {
  targetVersionId: string;
  targetLabel: string;
  /** Referencias contra las que comparar. La primera es la predeterminada. */
  bases: DiffBase[];
}

function useGraph(versionId: string | null) {
  return useQuery({
    queryKey: ['version-graph', versionId],
    queryFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/artifact-versions/${encodeURIComponent(versionId as string)}/graph`,
      ),
    enabled: Boolean(versionId),
    // El grafo de una versión es inmutable: no hace falta refrescarlo.
    staleTime: Infinity,
  });
}

const KIND_LABEL = { added: 'Añadido', removed: 'Eliminado', changed: 'Modificado' } as const;

function DiffRow({ change }: { change: DiffEntry }) {
  return (
    <li data-kind={change.kind} data-cosmetic={change.cosmetic ? 'yes' : 'no'}>
      <div className="diff-row-head">
        <code>{change.path}</code>
        <span className="diff-kind">{KIND_LABEL[change.kind]}</span>
        {change.cosmetic ? <span className="diff-cosmetic">sólo presentación</span> : null}
      </div>
      {change.kind === 'changed' ? (
        <div className="diff-values">
          <del>{change.before ?? '(vacío)'}</del>
          <ins>{change.after ?? '(vacío)'}</ins>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Qué cambia esta versión respecto de otra, elemento por elemento.
 *
 * Sustituye al bloque decorativo que decía «Graph and contract changes» sin
 * comparar nada. La comparación es estructural (por identificador de nodo, arista
 * o acción), de sólo lectura y se calcula en el cliente a partir de dos grafos
 * que el backend ya expone.
 */
export function VersionDiffPanel({ targetVersionId, targetLabel, bases }: VersionDiffPanelProps) {
  const [baseId, setBaseId] = useState(bases[0]?.versionId ?? '');
  const base = bases.find((candidate) => candidate.versionId === baseId) ?? bases[0];
  const baseGraph = useGraph(base?.versionId ?? null);
  const targetGraph = useGraph(targetVersionId || null);
  const loading = baseGraph.isPending || targetGraph.isPending;
  const failed = baseGraph.isError || targetGraph.isError;
  const diff = !loading && !failed ? diffGraphs(baseGraph.data, targetGraph.data) : null;
  const groups = diff ? groupByCollection(diff) : [];

  return (
    <Panel
      title="Resumen de Cambios"
      meta={diff ? `${diff.substantive.length} cambios de fondo` : 'Comparación estructural'}
    >
      {!bases.length ? (
        <div className="empty-state">
          Esta versión no declara una versión de origen, así que no hay contra qué compararla.
        </div>
      ) : (
        <>
          {bases.length > 1 ? (
            <label className="field">
              <span>Comparar contra</span>
              <select value={base?.versionId} onChange={(event) => setBaseId(event.target.value)}>
                {bases.map((candidate) => (
                  <option key={candidate.versionId} value={candidate.versionId}>
                    {candidate.label}
                    {candidate.hint ? ` · ${candidate.hint}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="diff-caption">
              Comparando <strong>{targetLabel}</strong> contra <strong>{base?.label}</strong>
              {base?.hint ? ` (${base.hint})` : ''}.
            </p>
          )}

          {loading ? (
            <div className="empty-state">Cargando ambas versiones del grafo…</div>
          ) : failed ? (
            <div className="empty-state">
              No fue posible leer uno de los dos grafos, así que esta pantalla no puede decir qué
              cambió. Revísalo en el editor antes de decidir.
            </div>
          ) : diff?.empty ? (
            <div className="empty-state">
              Ninguna de las dos versiones expone un grafo comparable.
            </div>
          ) : !diff?.entries.length ? (
            <div className="empty-state">
              Las dos versiones tienen exactamente el mismo grafo: esta versión no cambia nada.
            </div>
          ) : (
            <>
              <ul className="diff-counts">
                <li data-kind="added">{diff.counts.added} añadidos</li>
                <li data-kind="removed">{diff.counts.removed} eliminados</li>
                <li data-kind="changed">{diff.counts.changed} modificados</li>
              </ul>
              {groups.map((group) => (
                <section className="diff-group" key={group.label}>
                  <h3>
                    {group.label} <small>{group.entries.length}</small>
                  </h3>
                  <ul className="diff-entries">
                    {group.entries.map((change) => (
                      <DiffRow change={change} key={change.path + change.kind} />
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </>
      )}
    </Panel>
  );
}
