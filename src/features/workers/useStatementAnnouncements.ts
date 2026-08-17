'use client';

import { useEffect, useRef } from 'react';
import { ApiError } from '../../api/ApiError';
import { useNotifications } from '../../notifications/useNotifications';
import { runAnnouncement, uploadRejectionAnnouncement } from './statement-announcement';
import { isTerminal, type WorkerRun } from './worker-types';

/**
 * Anuncia el desenlace de una conversión, exactamente una vez.
 *
 * Vive en un hook y no dentro de la consola porque el «exactamente una vez» es
 * la parte que se rompe sola: el sondeo repite la misma respuesta cada segundo y
 * medio hasta que la vista se desmonta, así que un `useEffect` sin registro de lo
 * ya anunciado repite el toast en cada vuelta. La huella incluye el estado, no
 * sólo la solicitud: una ejecución reprocesada desde la cola de revisión vuelve a
 * QUEUED y merece su aviso nuevo cuando termine.
 *
 * El texto se escribe cuando el motor YA confirmó el estado. Anunciarlo junto a
 * la llamada declararía el desenlace antes de que exista.
 */
export function useRunAnnouncement(run: WorkerRun | undefined): void {
  const { notify } = useNotifications();
  const anunciado = useRef<string | null>(null);

  useEffect(() => {
    if (!run || !isTerminal(run.status)) return;
    const huella = `${run.requestId}:${run.status}`;
    if (anunciado.current === huella) return;
    const aviso = runAnnouncement(run);
    if (!aviso) return;
    anunciado.current = huella;
    notify(aviso);
  }, [run, notify]);
}

/**
 * El aviso de un rechazo en la PUERTA, donde no hay ejecución que sondear.
 *
 * El motor contesta con un código y sin fila, así que el único sitio del que
 * puede salir el mensaje es el fallo de la petición. Se traduce al mismo
 * vocabulario que los rechazos del análisis: a quien sube el archivo le da igual
 * en qué etapa se decidió que no servía.
 */
export function useUploadRejection(): (error: unknown) => void {
  const { notify } = useNotifications();
  return (error: unknown) => {
    const rechazo = uploadRejectionAnnouncement(error instanceof ApiError ? error.code : undefined);
    notify(
      rechazo ?? {
        tone: 'error',
        title: 'No se pudo encolar el extracto',
        description: error instanceof Error ? error.message : undefined,
      },
    );
  };
}
