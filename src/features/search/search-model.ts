import { asRows, display, type UnknownRecord } from '../../utils/records';

export interface SearchHit {
  entityType: string;
  entityId: string;
  code: string;
  title: string;
  subtitle: string | null;
}

export interface SearchResponse {
  query: string;
  total: number;
  items: SearchHit[];
}

const ENTITY_LABELS: Record<string, string> = {
  ARTIFACT: 'Artefactos',
  ARTIFACT_VERSION: 'Versiones',
  VARIABLE: 'Variables',
  REASON_CODE: 'Reason codes',
  OBJECTIVE: 'Objetivos',
  MANUAL_REVIEW: 'Revisiones manuales',
  EXECUTION: 'Ejecuciones',
  APPROVAL_REQUEST: 'Solicitudes de aprobación',
};

/** Human label for an entity_type coming from the vw_global_search view. */
export function entityTypeLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

/**
 * Maps a search hit to the portal route that renders it. Returns null when the
 * entity has no dedicated detail route (it still shows as a non-clickable row).
 */
export function hitHref(hit: SearchHit): string | null {
  switch (hit.entityType) {
    case 'ARTIFACT':
      return `/artifacts/${encodeURIComponent(hit.entityId)}`;
    case 'ARTIFACT_VERSION':
      return `/artifact-versions/${encodeURIComponent(hit.entityId)}/graph`;
    case 'VARIABLE':
      return '/variables';
    case 'REASON_CODE':
      return '/reason-codes';
    case 'OBJECTIVE':
      return `/objectives/${encodeURIComponent(hit.entityId)}`;
    case 'MANUAL_REVIEW':
      return `/manual-reviews/${encodeURIComponent(hit.entityId)}`;
    case 'EXECUTION':
      return `/executions/${encodeURIComponent(hit.entityId)}`;
    case 'APPROVAL_REQUEST':
      return `/approval-requests/${encodeURIComponent(hit.entityId)}`;
    default:
      return null;
  }
}

export function normalizeSearchResponse(payload: unknown): SearchResponse {
  const record = (payload ?? {}) as UnknownRecord;
  const items = asRows(record.items).map((row) => ({
    entityType: display(row, 'entityType'),
    entityId: display(row, 'entityId'),
    code: display(row, 'code'),
    title: display(row, 'title'),
    subtitle: row.subtitle === null || row.subtitle === undefined ? null : String(row.subtitle),
  }));
  return {
    query: display(record, 'query'),
    total: Number(record.total ?? items.length),
    items,
  };
}

export function groupHits(items: SearchHit[]): Array<{ entityType: string; hits: SearchHit[] }> {
  const groups = new Map<string, SearchHit[]>();
  for (const hit of items) {
    const bucket = groups.get(hit.entityType) ?? [];
    bucket.push(hit);
    groups.set(hit.entityType, bucket);
  }
  return [...groups.entries()].map(([entityType, hits]) => ({ entityType, hits }));
}
