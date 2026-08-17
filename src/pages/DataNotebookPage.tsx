'use client';

import { PageHeader } from '../components/PageHeader';
import { NotebookIndex } from '../features/data-notebook/NotebookIndex';

/**
 * La portada del cuaderno de datos: la lista, no el editor.
 *
 * Se entra eligiendo —seguir uno empezado o crear otro—, que es el orden de cualquier herramienta
 * de cuadernos. Abrir directo en una hoja en blanco esconde el trabajo ya hecho detrás de un panel
 * al que hay que saber bajar, y obliga a decidir qué analizar antes de recordar qué había.
 *
 * El editor vive en `/data-notebook/[notebookId]`: un cuaderno es una COSA con su propio enlace,
 * que se puede compartir por chat y volver a abrir mañana.
 */
export function DataNotebookPage() {
  return (
    <>
      <PageHeader
        eyebrow="Procesamiento"
        title="Cuadernos de datos"
        description="Tus cuadernos de análisis: elige uno para seguir donde lo dejaste o crea uno nuevo."
        hint="Dentro eliges el dataset y trabajas con Python o JavaScript, celda a celda. El código corre en tu propia pestaña —no viaja a ningún servidor— y al guardar se conserva también lo que cada celda arrojó, con su fecha."
      />
      <NotebookIndex />
    </>
  );
}
