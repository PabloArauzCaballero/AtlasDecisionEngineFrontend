'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, type UnknownRecord } from '../../utils/records';
import { readStressSeries, type StressSeries } from './qa-stress';

/**
 * Las corridas de QA Lab de la MISMA versión que se está monitoreando.
 *
 * Es toda la sincronización: no hay un endpoint nuevo ni una tabla nueva, porque las corridas
 * del QA Lab ya están archivadas por versión y lo único que faltaba era pedirlas desde aquí.
 *
 * Se consulta —y no se muta— a propósito: a diferencia de los tres análisis de esta pantalla,
 * esto es un historial, cambia sólo cuando alguien lanza una corrida, y se quiere ver nada más
 * elegir la versión, sin pulsar «Medir». Ése es el punto de la sincronización: que quien vigila
 * el modelo vea la última prueba de esfuerzo sin ir a otra pantalla a buscarla.
 *
 * `refetchInterval` mientras haya alguna corrida viva: una lanzada desde el QA Lab en otra
 * pestaña se cierra minutos después, y sin refresco esta vista se quedaría enseñándola en
 * marcha para siempre.
 */
export function useQaStressRuns(versionId: string): {
  series: StressSeries;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: ['qa-stress-runs', versionId],
    enabled: Boolean(versionId),
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(
        `/v1/qa-lab/runs?pageSize=20&artifactVersionId=${encodeURIComponent(versionId)}`,
        { signal },
      ),
    refetchInterval: (query) =>
      asRows(asRecord(query.state.data).items).some((row) => row.status === 'RUNNING')
        ? 4_000
        : false,
  });

  return {
    series: readStressSeries(asRows(asRecord(query.data).items)),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
