'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, NotebookPen, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NavLink } from '../../navigation/NavLink';
import { useNotifications } from '../../notifications/useNotifications';
import { createNotebook, deleteNotebook, fetchNotebooks } from './notebook-documents.api';

const CLAVE = ['data-notebook', 'notebooks'];

/**
 * La primera pantalla del cuaderno: ELEGIR uno, no empezar a escribir.
 *
 * Es el orden de cualquier herramienta de cuadernos, y no es una convención vacía. Abrir
 * directamente un cuaderno en blanco obliga a decidir dos cosas a la vez —qué analizar y sobre qué
 * documento— y, sobre todo, esconde lo que ya está hecho: el trabajo de ayer queda detrás de un
 * panel al que hay que saber que se puede bajar. Con la lista delante, «seguir donde lo dejé» es lo
 * primero que se ve.
 *
 * La tabla dice celdas y fecha porque son las dos preguntas con las que se elige entre varios:
 * cuál es el grande y cuál es el último que toqué.
 */
export function NotebookIndex() {
  const router = useRouter();
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState('');

  const lista = useQuery({ queryKey: CLAVE, queryFn: ({ signal }) => fetchNotebooks(signal) });

  const crear = useMutation({
    mutationFn: () =>
      createNotebook({
        title: titulo.trim() || 'Cuaderno sin título',
        // Una celda de Python vacía: lo mismo que se ve al abrir un cuaderno nuevo en cualquier
        // herramienta, y lo que el contrato exige —un cuaderno con cero celdas no es un cuaderno—.
        cells: [{ kind: 'code', language: 'python', source: 'df.head()' }],
      }),
    onSuccess: async (documento) => {
      await queryClient.invalidateQueries({ queryKey: CLAVE });
      // Se ENTRA al cuaderno recién creado. Quedarse en la lista obligaría a buscarlo y abrirlo,
      // que es exactamente lo que quien pulsa «Nuevo cuaderno» acaba de decir que quiere hacer.
      router.push(`/data-notebook/${documento.id}`);
    },
  });

  const borrar = useMutation({
    mutationFn: (id: string) => deleteNotebook(id),
    onSuccess: async () => {
      notify({ tone: 'success', title: 'Cuaderno borrado' });
      await queryClient.invalidateQueries({ queryKey: CLAVE });
    },
  });

  return (
    <section className="notebook-index" aria-label="Mis cuadernos">
      <header className="notebook-index__head">
        <label className="notebook-index__nombre">
          <span className="sr-only">Nombre del cuaderno nuevo</span>
          <input
            type="text"
            value={titulo}
            placeholder="Nombre del cuaderno nuevo"
            maxLength={160}
            onChange={(evento) => setTitulo(evento.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button--primary"
          onClick={() => crear.mutate()}
          disabled={crear.isPending}
        >
          <FilePlus2 aria-hidden="true" size={14} /> Nuevo cuaderno
        </button>
      </header>

      {lista.isLoading ? <p className="notebook-index__vacio">Cargando tus cuadernos…</p> : null}

      {lista.data?.length ? (
        <div className="notebook-index__tabla-envoltura">
          <table className="notebook-index__tabla">
            <caption className="sr-only">
              Cuadernos guardados, del más reciente al más antiguo
            </caption>
            <thead>
              <tr>
                <th scope="col">Cuaderno</th>
                <th scope="col">Celdas</th>
                <th scope="col">Dataset</th>
                <th scope="col">Última vez</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.data.map((cuaderno) => (
                <tr key={cuaderno.id}>
                  <th scope="row">
                    <NavLink
                      href={`/data-notebook/${cuaderno.id}`}
                      className="notebook-index__abrir"
                    >
                      <NotebookPen aria-hidden="true" size={14} /> {cuaderno.title}
                    </NavLink>
                  </th>
                  <td>{cuaderno.cellCount}</td>
                  <td>{cuaderno.datasetCode ?? '—'}</td>
                  <td>{new Date(cuaderno.updatedAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="button"
                      onClick={() => borrar.mutate(cuaderno.id)}
                      disabled={borrar.isPending}
                      aria-label={`Borrar ${cuaderno.title}`}
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!lista.isLoading && !lista.data?.length ? (
        <p className="notebook-index__vacio">
          Todavía no tienes ninguno. Pon un nombre y pulsa «Nuevo cuaderno»: dentro eliges el
          dataset y escribes las celdas.
        </p>
      ) : null}
    </section>
  );
}
