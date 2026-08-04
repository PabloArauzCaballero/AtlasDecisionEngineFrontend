'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRun, type WorkerCode } from './workers.api';
import { isTerminal, type WorkerRun } from './worker-types';

/**
 * Sigue una ejecución hasta que termina.
 *
 * Sondeo y no un canal abierto: el motor no publica eventos de servidor para
 * este dominio, y abrir uno sólo para dos vistas sería infraestructura nueva
 * (§12 del encargo). El coste está acotado porque el sondeo **se detiene solo**
 * en cuanto el estado es terminal: `refetchInterval` devuelve `false` y react-query
 * deja de pedir. Sin esa parada, una pestaña abierta toda la tarde seguiría
 * preguntando por una ejecución que acabó hace horas.
 */
export function useWorkerRun(worker: WorkerCode, requestId: string | null) {
  return useQuery({
    queryKey: ['worker-run', worker, requestId],
    enabled: requestId !== null,
    queryFn: ({ signal }) => fetchRun(worker, requestId as string, signal),
    refetchInterval: (query) => {
      const run = query.state.data as WorkerRun | undefined;
      if (!run) return 1_500;
      return isTerminal(run.status) ? false : 1_500;
    },
    // Mientras la ejecución corre, un dato de hace un segundo ya no sirve.
    staleTime: 0,
  });
}
