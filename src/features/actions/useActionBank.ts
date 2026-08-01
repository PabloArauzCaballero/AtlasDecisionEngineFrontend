'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { snapshotToEditableGraph } from '../../graph/graph.adapter';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { toActionBank, type VersionGraph } from './action-bank';

const BANK_KEY = ['action-bank'];

/**
 * Carga el banco de acciones de todo el tenant.
 *
 * El motor no expone las acciones como recurso propio —viven dentro del grafo de
 * cada versión—, así que el banco se compone leyendo el selector de versiones y
 * el grafo de cada una. Es una sola consulta de cache para toda la página: las
 * versiones son pocas y los grafos ya se piden enteros en el editor.
 */
export function useActionBank() {
  const query = useQuery({
    queryKey: BANK_KEY,
    queryFn: async ({ signal }) => {
      const versions = await apiRequest<UnknownRecord[]>('/v1/views/pickers/artifact-versions', {
        signal,
      });
      return Promise.all(asRows(versions).map((version) => loadVersion(version, signal)));
    },
  });

  const graphs = query.data ?? [];
  return {
    entries: toActionBank(graphs),
    versions: graphs,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
  };
}

async function loadVersion(version: UnknownRecord, signal: AbortSignal): Promise<VersionGraph> {
  const versionId = display(version, 'id');
  const graph = asRecord(
    await apiRequest<UnknownRecord>(
      `/v1/artifact-versions/${encodeURIComponent(versionId)}/graph`,
      { signal },
    ),
  );
  return {
    versionId,
    artifactCode: display(version, 'artifactCode'),
    artifactName: display(version, 'artifactName'),
    semanticVersion: display(version, 'semanticVersion'),
    status: display(version, 'status'),
    actions: asRows(graph.actions),
    nodes: asRows(graph.nodes),
  };
}

export interface ActionWrite {
  versionId: string;
  /** La acción a escribir; sin ella la operación es un borrado. */
  action?: UnknownRecord;
  /** Código a quitar de la versión. */
  remove?: string;
}

/**
 * Escribe una acción en una versión concreta.
 *
 * Lee el grafo y su `lockVersion` en el momento de guardar y devuelve el grafo
 * entero con la acción añadida, reemplazada o quitada. Se hace en una sola
 * operación —y no manteniendo un borrador en memoria— porque desde el banco se
 * toca una versión que no se está editando: partir de una copia cargada minutos
 * antes pisaría cambios ajenos, y el `if-match` los convertiría en un conflicto
 * en lugar de en una pérdida silenciosa.
 */
export function useActionWrite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, action, remove }: ActionWrite) => {
      const encoded = encodeURIComponent(versionId);
      const [graph, version] = await Promise.all([
        apiRequest<UnknownRecord>(`/v1/artifact-versions/${encoded}/graph`),
        apiRequest<UnknownRecord>(`/v1/artifact-versions/${encoded}`),
      ]);
      const current = asRows(asRecord(graph).actions);
      const next = remove
        ? current.filter((entry) => display(entry, 'code') !== remove)
        : upsert(current, action as UnknownRecord);

      return apiRequest<UnknownRecord>(`/v1/artifact-versions/${encoded}/graph`, {
        method: 'PUT',
        headers: { 'if-match': display(version, 'lockVersion') },
        body: snapshotToEditableGraph({ ...asRecord(graph), actions: next }),
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: BANK_KEY }),
  });
}

function upsert(actions: UnknownRecord[], action: UnknownRecord): UnknownRecord[] {
  const code = display(action, 'code');
  return actions.some((entry) => display(entry, 'code') === code)
    ? actions.map((entry) => (display(entry, 'code') === code ? action : entry))
    : [...actions, action];
}
