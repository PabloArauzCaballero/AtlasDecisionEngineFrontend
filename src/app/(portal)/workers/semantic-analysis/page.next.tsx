'use client';

import { WorkersPage } from '../../../../pages/WorkersPage';

/**
 * Enlace directo al worker semántico.
 *
 * Sigue siendo una ruta propia y no un `?worker=` sobre `/workers` porque el
 * permiso se decide por ruta (`route-access.ts`): con un comodín, un worker
 * nuevo heredaría el acceso de los que ya existen sin que nadie lo decida.
 */
export default function SemanticAnalysisWorkerRoute() {
  return <WorkersPage initialWorker="semantic-analysis" />;
}
