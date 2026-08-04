import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows } from '../../utils/records';
import { deriveEnvironmentHeads, type EnvironmentHead } from './environment-heads';

/**
 * Versiones vigentes de un artefacto en cada ambiente.
 *
 * Vive en un hook compartido para que la ficha del artefacto y la pantalla de
 * aprobación hagan **la misma** consulta: con la misma `queryKey`, React Query
 * la resuelve una vez y las dos vistas no pueden discrepar sobre qué está
 * decidiendo en producción.
 */
export function useArtifactHeads(artifactCode: string) {
  const enabled = Boolean(artifactCode) && artifactCode !== '—';
  const query = useQuery({
    queryKey: ['artifact-environment-heads', artifactCode],
    queryFn: () =>
      apiRequest<unknown>(
        `/v1/deployments?page=1&pageSize=50&artifactCode=${encodeURIComponent(artifactCode)}`,
      ),
    enabled,
    select: (data) => deriveEnvironmentHeads(asRows(asRecord(data).items)),
  });
  const heads: EnvironmentHead[] = query.data ?? [];
  return { ...query, enabled, heads };
}
