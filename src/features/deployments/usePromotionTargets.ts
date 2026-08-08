'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { canPromoteToEnvironment } from '../../auth/business-rules';
import { useAuth } from '../../auth/useAuth';
import { environmentsSchema } from '../../testing/testing.schemas';
import { splitPromotionTargets, type EnvironmentOption } from './promotion-targets';

const NONE: EnvironmentOption[] = [];

/**
 * Ambientes a los que el usuario en sesión puede promover una versión.
 *
 * Los ambientes salen del motor, nunca de una lista escrita a mano: qué
 * ambientes existen y cuál es productivo lo decide el despliegue, y una lista
 * fija se desfasa en silencio (mismo criterio que `useSafeEnvironments`).
 *
 * Si el catálogo no carga, no se inventa nada: la lista queda vacía y el
 * formulario lo dice. Ofrecer un `PROD` supuesto sería peor que no ofrecer nada.
 */
export function usePromotionTargets() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canPromoteToProduction = canPromoteToEnvironment(roles, {
    code: 'PROD',
    isProduction: true,
  });

  const query = useQuery({
    queryKey: ['promotion-environments'],
    queryFn: ({ signal }) =>
      apiRequest('/v1/environments', { signal, responseSchema: environmentsSchema }),
    staleTime: 60_000,
  });

  const split = splitPromotionTargets(query.data ?? NONE, canPromoteToProduction);

  return {
    ...split,
    roles,
    canPromoteToProduction,
    isPending: query.isPending,
    isError: query.isError,
  };
}
