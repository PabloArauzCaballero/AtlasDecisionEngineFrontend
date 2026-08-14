'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { useNotifications } from '../../notifications/useNotifications';
import { asRecord, display, type UnknownRecord } from '../../utils/records';

/**
 * Lanza una corrida del QA Lab y la sigue hasta que cierra.
 *
 * El `POST` responde 202 con la corrida en `RUNNING` y el lote se ejecuta DESPUÉS, así que
 * esperar la respuesta no es esperar el resultado. Tiene que ser así: el motor corta toda
 * petición HTTP a los 15 s, y doscientos casos no caben ahí ni de lejos —«Request exceeded
 * 15000 ms» era exactamente eso—. Quien mira la pantalla no debería notar la diferencia,
 * y de eso se encarga este enganche: pregunta por la corrida cada segundo y medio mientras
 * viva, y para en cuanto llega a `COMPLETED` o `FAILED`.
 */
const POLL_MS = 1_500;

const CLOSED = ['COMPLETED', 'FAILED'];

function isClosed(run: UnknownRecord): boolean {
  return CLOSED.includes(String(run.status ?? ''));
}

export interface QaRunTracking {
  /** La corrida que se está mirando: la lanzada, o una del historial. */
  run: UnknownRecord;
  /** Sigue trabajando: ni `COMPLETED` ni `FAILED`. */
  active: boolean;
  /** El `POST` está en vuelo. Dura un instante; no es la duración de la corrida. */
  launching: boolean;
  error: unknown;
  launch: (body: UnknownRecord) => void;
  /** Mirar una corrida del historial sin lanzarla otra vez. */
  inspect: (runId: string) => void;
}

export function useQaRun(versionId: string): QaRunTracking {
  const [runId, setRunId] = useState('');
  // Sólo se avisa del desenlace de las corridas que se lanzaron DESDE aquí. Sin esta
  // marca, abrir una corrida vieja del historial soltaba un aviso de «corrida terminada»
  // por algo que había terminado la semana pasada.
  const launched = useRef('');
  const announced = useRef('');
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ['qa-run', runId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/qa-lab/runs/${encodeURIComponent(runId)}`, { signal }),
    enabled: Boolean(runId),
    // Se deja de preguntar en cuanto la corrida cierra: seguir sondeando una corrida
    // terminada es tráfico contra el motor que no puede traer nada nuevo.
    refetchInterval: (query) => (isClosed(asRecord(query.state.data)) ? false : POLL_MS),
  });

  const start = useMutation({
    mutationFn: (body: UnknownRecord) =>
      apiRequest<UnknownRecord>(`/v1/qa-lab/versions/${encodeURIComponent(versionId)}/runs`, {
        method: 'POST',
        body,
      }),
    onSuccess: (started) => {
      const id = String(asRecord(started).id ?? '');
      launched.current = id;
      setRunId(id);
    },
  });

  const run = asRecord(detail.data ?? start.data);
  /*
   * `display()` NO sirve para decidir: cuando el campo falta devuelve «—», que es un texto
   * para leer y un valor perfectamente truthy. Leyendo el id con él, una pantalla recién
   * abierta —sin ninguna corrida— se creía con una corrida en marcha, y el botón de lanzar
   * nacía desactivado y no se activaba nunca.
   */
  const currentId = String(run.id ?? '');
  const status = String(run.status ?? '');
  const passed = display(run, 'passedCases');
  const total = display(run, 'totalCases');
  const failed = Number(run.failedCases ?? 0);
  const seed = display(run, 'seed');

  useEffect(() => {
    if (!currentId || !CLOSED.includes(status)) return;
    if (launched.current !== currentId || announced.current === currentId) return;
    announced.current = currentId;

    if (status === 'FAILED') {
      notify({
        tone: 'error',
        title: 'La corrida no llegó a terminar',
        description: `Quedó archivada como fallida. Abre su detalle para ver el motivo; la semilla ${seed} sirve para repetirla.`,
      });
    } else {
      notify({
        tone: failed > 0 ? 'warning' : 'success',
        title: `Corrida terminada: ${passed}/${total} casos correctos`,
        description:
          failed > 0
            ? `${failed} caso(s) violan alguna propiedad. Revisa los contraejemplos.`
            : `Semilla ${seed} archivada para reproducir la corrida.`,
      });
    }
    void queryClient.invalidateQueries({ queryKey: ['qa-runs'] });
  }, [currentId, status, passed, total, failed, seed, notify, queryClient]);

  return {
    run,
    active: Boolean(currentId) && !isClosed(run),
    launching: start.isPending,
    error: start.error,
    launch: (body) => start.mutate(body),
    inspect: setRunId,
  };
}
