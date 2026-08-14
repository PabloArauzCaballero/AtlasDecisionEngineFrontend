'use client';

import { WorkersPage } from '../../../../pages/WorkersPage';

/**
 * Enlace directo al generador documental.
 *
 * Ruta propia y no un `?worker=` sobre `/workers`, por lo mismo que las otras
 * cuatro: el permiso se decide por ruta (`route-access.ts`), y con un comodín
 * una vista nueva heredaría el acceso de las que ya existen sin que nadie lo
 * decida.
 */
export default function PdfGeneratorRoute() {
  return <WorkersPage initialWorker="pdf-generator" />;
}
