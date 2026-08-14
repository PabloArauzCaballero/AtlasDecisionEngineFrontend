import type { WorkerRun } from './worker-types';

/**
 * La traza de una ejecución, descargable como JSON.
 *
 * Existe porque «salió mal» no se puede depurar desde una captura de pantalla:
 * la traza lleva TODO lo que el motor publicó de la ejecución —estado, intentos,
 * tiempos, resultado completo con su evidencia y su bloque `diagnostics` cuando
 * el worker lo emite, advertencias y códigos de error— en un archivo que se
 * puede adjuntar a un ticket o pegar en una conversación.
 *
 * Lo que NO lleva es más de lo que el motor ya publica: el número de documento
 * viaja enmascarado y el texto locutado no viaja, porque la traza sale del
 * mismo `result_json` que la pantalla. Los registros del servidor no se
 * almacenan por ejecución; el `correlationId` incluido es la llave para
 * encontrarlos en los logs del motor.
 */
export interface RunTrace {
  tipo: 'traza-de-ejecucion';
  worker: string;
  descargadaEn: string;
  ejecucion: WorkerRun;
  comoUsarla: string;
}

export function buildRunTrace(worker: string, run: WorkerRun): RunTrace {
  return {
    tipo: 'traza-de-ejecucion',
    worker,
    descargadaEn: new Date().toISOString(),
    ejecucion: run,
    comoUsarla:
      'El detalle de la ejecución está en `ejecucion.result` (incluido `diagnostics` cuando el ' +
      'worker lo publica). Para los registros del servidor, filtra por ' +
      '`ejecucion.correlationId` en los logs del motor.',
  };
}

/** Dispara la descarga del JSON en el navegador. */
export function downloadRunTrace(worker: string, run: WorkerRun): void {
  const blob = new Blob([JSON.stringify(buildRunTrace(worker, run), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `traza-${worker}-${run.requestId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
