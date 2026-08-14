'use client';

import { WorkersPage } from '../../../../pages/WorkersPage';

/**
 * Enlace directo al cuaderno de datos.
 *
 * Ruta propia y no un `?worker=` sobre `/workers`, por lo mismo que los demás: el permiso se
 * decide por ruta (`route-access.ts`), y con un comodín una herramienta nueva heredaría el acceso
 * de las que ya existen sin que nadie lo decida. Aquí importa más que en el resto: el cuaderno
 * sirve datos de personas reales, aunque enmascarados.
 */
export default function DataNotebookRoute() {
  return <WorkersPage initialWorker="data-notebook" />;
}
