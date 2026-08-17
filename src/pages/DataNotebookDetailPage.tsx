'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { DataNotebookConsole } from '../features/data-notebook/DataNotebookConsole';
import { fetchNotebook } from '../features/data-notebook/notebook-documents.api';
import { NavLink } from '../navigation/NavLink';

/**
 * Un cuaderno concreto, con su propio enlace.
 *
 * La consola no se monta hasta que el documento está: necesita las celdas y el dataset para
 * arrancar, y montarla antes obligaría a un estado intermedio —un cuaderno vacío que se rellena
 * solo— en el que un guardado prematuro escribiría una hoja en blanco encima del trabajo.
 */
export function DataNotebookDetailPage({ notebookId }: { notebookId: string }) {
  const cuaderno = useQuery({
    queryKey: ['data-notebook', 'notebook', notebookId],
    queryFn: ({ signal }) => fetchNotebook(notebookId, signal),
    retry: false,
    /*
     * Lo que se acaba de guardar no se vuelve a pedir.
     *
     * Un cuaderno sólo cambia cuando su dueño lo guarda —es de una persona y no se comparte—, y al
     * guardarlo la barra escribe la respuesta del servidor en esta misma clave. Sin este plazo,
     * React Query lo daba por caduco al montar y volvía a descargarlo entero, tablas y gráficos
     * incluidos, para recibir exactamente lo que ya tenía: la espera que se notaba al reabrir.
     *
     * No es una caché ciega: cambiar de cuaderno usa otra clave y sí pide, y recargar la página
     * entera vacía la caché. Lo único que se evita es volver a pedir lo que se acaba de escribir.
     */
    staleTime: 5 * 60_000,
  });

  return (
    <>
      <PageHeader
        eyebrow="Procesamiento · Cuadernos"
        title={cuaderno.data?.title ?? 'Cuaderno de datos'}
        description="Elige el dataset, escribe celdas y guarda el avance: al reabrirlo verás lo que cada celda arrojó, con su fecha."
        hint="El código corre en tu propia pestaña y no viaja a ningún servidor. Lo que se guarda son las celdas y sus resultados —filas ya enmascaradas—, nunca datos en claro."
      />

      <p className="notebook-detalle__volver">
        <NavLink href="/data-notebook">
          <ArrowLeft aria-hidden="true" size={14} /> Todos mis cuadernos
        </NavLink>
      </p>

      {cuaderno.isLoading ? <p className="notebook-index__vacio">Abriendo el cuaderno…</p> : null}

      {cuaderno.isError ? (
        <p className="notebook-dataset__error" role="alert">
          No se pudo abrir este cuaderno. O no existe, o es de otra persona: cada cuaderno es de
          quien lo escribió.
        </p>
      ) : null}

      {cuaderno.data ? <DataNotebookConsole documento={cuaderno.data} /> : null}
    </>
  );
}
