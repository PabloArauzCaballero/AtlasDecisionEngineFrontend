'use client';

import { DataNotebookPage } from '../../../pages/DataNotebookPage';

/**
 * Ruta propia, fuera de `/workers`.
 *
 * El permiso se decide por ruta (`route-access.ts`) y el del cuaderno es más estrecho que el de los
 * workers: sirve filas de personas reales, aunque enmascaradas. Colgando de `/workers/*` esa
 * diferencia quedaba a un comodín de distancia de perderse.
 */
export default function DataNotebookRoute() {
  return <DataNotebookPage />;
}
