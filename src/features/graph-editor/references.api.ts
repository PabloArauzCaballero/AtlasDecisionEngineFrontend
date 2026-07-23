import { apiRequest } from '../../api/http-client';
import { asRows, type UnknownRecord } from '../../utils/records';
import type { CreateReferenceBody } from './reference-authoring';

function base(versionId: string): string {
  return `/v1/artifact-versions/${encodeURIComponent(versionId)}/references`;
}

/** Existing nested-artifact references bound to this parent version. */
export async function listReferences(
  versionId: string,
  signal?: AbortSignal,
): Promise<UnknownRecord[]> {
  const data = await apiRequest<UnknownRecord[] | { items: UnknownRecord[] }>(base(versionId), {
    signal,
  });
  return Array.isArray(data) ? asRows(data) : asRows((data as { items?: unknown }).items);
}

export function createReference(
  versionId: string,
  body: CreateReferenceBody,
): Promise<UnknownRecord> {
  return apiRequest<UnknownRecord>(base(versionId), { method: 'POST', body });
}

export function deleteReference(versionId: string, referenceId: string): Promise<unknown> {
  return apiRequest(`${base(versionId)}/${encodeURIComponent(referenceId)}`, { method: 'DELETE' });
}
