'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { useNotifications } from '../../notifications/useNotifications';
import type { NotebookCell } from './notebook-types';
import { updateNotebook, type NotebookDocument, type StoredCell } from './notebook-documents.api';

interface NotebookSaveBarProps {
  documento: NotebookDocument;
  datasetCode: string;
  cells: readonly NotebookCell[];
}

/**
 * Del estado de la pantalla a lo que se guarda, con una regla: se guarda lo que se VE.
 *
 * Incluye el resultado de cada celda —tabla, valor, registro y gráficos—, que es lo que hace que
 * reabrir un cuaderno devuelva el trabajo y no una hoja en blanco. Lo que NO viaja es `running`
 * (un estado de esta sesión, no del documento) ni el número de ejecución, que sólo ordena celdas
 * dentro de una misma corrida.
 *
 * `savedAt` se sella aquí, en el momento de guardar, y no en el de ejecutar: es la fecha que la
 * celda enseñará al restaurarse, y lo que importa de ella es que el lector sepa que lo que mira no
 * se acaba de calcular.
 */
function aGuardable(celdas: readonly NotebookCell[], sello: string): StoredCell[] {
  return celdas.map((celda) => ({
    kind: celda.kind,
    language: celda.language,
    source: celda.source,
    outcome: celda.outcome
      ? {
          status: celda.outcome.status,
          logs: celda.outcome.logs,
          durationMs: celda.outcome.durationMs,
          ...(celda.outcome.status === 'ok'
            ? {
                value: celda.outcome.value,
                table: celda.outcome.table,
                images: celda.outcome.images,
              }
            : { error: celda.outcome.error }),
          // Un resultado ya restaurado conserva SU fecha: volver a guardarlo sin ejecutarlo no lo
          // hace más nuevo, y refrescar el sello lo haría parecer recién calculado.
          savedAt: celda.outcome.savedAt ?? sello,
        }
      : null,
  }));
}

export function NotebookSaveBar({ documento, datasetCode, cells }: NotebookSaveBarProps) {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState(documento.title);

  const guardar = useMutation({
    mutationFn: () =>
      updateNotebook(documento.id, {
        title: titulo.trim() || 'Cuaderno sin título',
        datasetCode: datasetCode || null,
        cells: aGuardable(cells, new Date().toISOString()),
      }),
    onSuccess: async (guardado) => {
      const conResultado = guardado.cells.filter((celda) => celda.outcome).length;
      notify({
        tone: 'success',
        title: `«${guardado.title}» guardado`,
        description: `${guardado.cells.length} celdas, ${conResultado} con su resultado. Al reabrirlo verás lo mismo, fechado.`,
      });
      /*
       * El documento guardado se ESCRIBE en la caché, no se invalida.
       *
       * Antes sólo se invalidaba la lista, así que volver al índice y reabrir el cuaderno lo pedía
       * otra vez al servidor. Y no es una petición pequeña: dentro viajan las tablas de cada celda
       * y los gráficos en base64, de modo que reabrir algo que se acababa de guardar tardaba lo
       * mismo que abrirlo por primera vez —con la sensación, peor todavía, de que el guardado no
       * había servido de nada—.
       *
       * La respuesta del servidor ES el documento recién guardado: el mismo que la pantalla de
       * detalle va a pedir. Plantarlo en su clave hace que reabrir sea instantáneo y, sobre todo,
       * exacto: no se está enseñando una versión optimista de lo que se envió, sino lo que el
       * backend confirmó haber escrito.
       */
      queryClient.setQueryData(['data-notebook', 'notebook', guardado.id], guardado);
      await queryClient.invalidateQueries({ queryKey: ['data-notebook', 'notebooks'] });
    },
  });

  return (
    <div className="notebook-savebar">
      <label className="notebook-savebar__nombre">
        <span className="sr-only">Nombre del cuaderno</span>
        <input
          type="text"
          value={titulo}
          maxLength={160}
          onChange={(evento) => setTitulo(evento.target.value)}
        />
      </label>
      <button
        type="button"
        className="button button--primary"
        onClick={() => guardar.mutate()}
        disabled={guardar.isPending}
      >
        <Save aria-hidden="true" size={14} /> {guardar.isPending ? 'Guardando…' : 'Guardar avance'}
      </button>
    </div>
  );
}
