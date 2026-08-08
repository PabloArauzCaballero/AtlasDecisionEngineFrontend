'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, display } from '../../utils/records';

/** Referencia estable para el caso vacío: evita re-render por identidad nueva. */
const NONE: string[] = [];

/**
 * En qué ambientes está desplegado ahora mismo un artefacto.
 *
 * El simulador ejecuta contra el **artefacto compilado que está desplegado** en
 * el ambiente elegido: sin despliegue activo no hay nada que simular, y el
 * motor responde `ACTIVE_DEPLOYMENT_NOT_FOUND`. Ese rechazo es correcto, pero
 * llegaba a la pantalla como «No active deployment for X in TEST» —en inglés,
 * y después de que el usuario hubiera rellenado el formulario entero—.
 *
 * Preguntándolo antes se puede decir cuáles sirven **mientras se elige**, que
 * es cuando la respuesta cambia lo que uno hace. La decisión sigue siendo del
 * motor: esto no autoriza nada, sólo evita ofrecer un camino sin salida.
 */
export function useArtifactDeployments(artifactCode: string) {
  const code = artifactCode.trim();
  const query = useQuery({
    queryKey: ['artifact-deployments', code],
    enabled: code !== '',
    queryFn: ({ signal }) =>
      apiRequest<unknown>(
        `/v1/deployments?artifactCode=${encodeURIComponent(code)}&status=ACTIVE&page=1&pageSize=50`,
        { signal },
      ),
    select: (payload) =>
      asRows(asRecord(payload).items)
        // `isActive` además del filtro por estado: un despliegue puede estar
        // ACTIVE y ya vencido por su ventana de vigencia, y ése tampoco resuelve.
        .filter((row) => row.isActive !== false)
        .map((row) => display(asRecord(row.environment), 'code'))
        .filter((environmentCode) => environmentCode !== '—'),
  });

  const environmentCodes = query.data ?? NONE;
  return {
    environmentCodes,
    isPending: query.isPending,
    /** Si el motor no contesta, no se bloquea nada: que decida él al ejecutar. */
    unknown: query.isError,
    has: (environmentCode: string) =>
      query.isError || query.isPending || environmentCodes.includes(environmentCode),
  };
}
