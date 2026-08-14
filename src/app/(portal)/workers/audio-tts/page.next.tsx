'use client';

import { WorkersPage } from '../../../../pages/WorkersPage';

/**
 * Enlace directo al worker de locución.
 *
 * Ruta propia y no un `?worker=` sobre `/workers`, por lo mismo que las otras
 * tres: el permiso se decide por ruta (`route-access.ts`), y con un comodín un
 * worker nuevo heredaría el acceso de los que ya existen sin que nadie lo
 * decida.
 */
export default function AudioTtsWorkerRoute() {
  return <WorkersPage initialWorker="audio-tts" />;
}
