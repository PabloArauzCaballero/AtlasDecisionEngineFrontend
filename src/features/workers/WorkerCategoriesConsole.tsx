'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Panel } from '../../components/Panel';
import { useNotifications } from '../../notifications/useNotifications';
import { CategoryForm } from './CategoryForm';
import { CategoryImportPanel } from './CategoryImportPanel';
import { CategoryTree } from './CategoryTree';
import { CategoryTreeToolbar } from './CategoryTreeToolbar';
import { armarArbol, useRamasCerradas } from './category-tree.model';
import {
  deactivateCategory,
  fetchCategories,
  importCategories,
  saveCategory,
  type ImportSummary,
  type SemanticCategory,
} from './categories.api';

/**
 * Administración del árbol de categorías, dentro del propio worker.
 *
 * Vive aquí y no en una sección de ajustes porque es donde se descubre que hace
 * falta: se clasifica un extracto, sale «Sin determinar» en un movimiento que sí
 * dice algo, y el arreglo está a una pestaña de distancia. Separarlo obligaría a
 * salir del worker, buscar la pantalla y volver a empezar.
 *
 * Tras guardar se avisa de que el motor tarda hasta un minuto en recoger el
 * cambio: su caché de catálogo dura eso. Sin decirlo, quien clasifique
 * inmediatamente después vería el veredicto viejo y pensaría que no se guardó.
 */
export function WorkerCategoriesConsole() {
  const cliente = useQueryClient();
  const { notify } = useNotifications();
  const [editando, setEditando] = useState<SemanticCategory | 'nueva' | null>(null);
  const [padrePorDefecto, setPadrePorDefecto] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ImportSummary | null>(null);

  const categorias = useQuery({
    queryKey: ['semantic-categories'],
    queryFn: ({ signal }) => fetchCategories(signal),
  });

  const refrescar = async () => {
    await cliente.invalidateQueries({ queryKey: ['semantic-categories'] });
  };

  const guardar = useMutation({
    mutationFn: saveCategory,
    onSuccess: async (categoria) => {
      notify({
        tone: 'success',
        title: `Categoría ${categoria.code} guardada`,
        description: 'El clasificador la usará en cuanto caduque su caché de catálogo (≤ 1 min).',
      });
      setEditando(null);
      await refrescar();
    },
  });

  const desactivar = useMutation({
    mutationFn: deactivateCategory,
    onSuccess: async (categoria) => {
      notify({ tone: 'success', title: `Categoría ${categoria.code} desactivada` });
      await refrescar();
    },
  });

  const inyectar = useMutation({
    mutationFn: ({ lista, seco }: { lista: unknown[]; seco: boolean }) =>
      importCategories(lista, seco),
    onSuccess: async (resultado) => {
      setResumen(resultado);
      if (!resultado.dryRun) {
        notify({
          tone: 'success',
          title: `Inyectadas ${String(resultado.total)} categorías`,
          description: `${String(resultado.created.length)} nuevas y ${String(resultado.updated.length)} reemplazadas.`,
        });
        await refrescar();
      }
    },
  });

  const lista = useMemo(() => categorias.data ?? [], [categorias.data]);
  const codigos = useMemo(() => lista.map((categoria) => categoria.code), [lista]);
  // El plegado vive aquí porque lo comparten la barra —«expandir todo»— y el
  // árbol. Guardado dentro del árbol, la barra no tendría cómo alcanzarlo.
  const raices = useMemo(() => armarArbol(lista), [lista]);
  const control = useRamasCerradas(raices);

  return (
    <div className="worker-categorias">
      <Panel
        title="Árbol de categorías"
        meta={lista.length > 0 ? `${String(lista.length)} categorías` : undefined}
      >
        <p className="field-help">
          Es el catálogo contra el que clasifica el worker. La clasificación recae en las{' '}
          <strong>hojas</strong>: una rama agrupa y por eso lleva umbral 1, que la vuelve
          inalcanzable a propósito.
        </p>

        <CategoryTreeToolbar
          categorias={lista}
          control={control}
          onNueva={() => {
            setPadrePorDefecto(null);
            setEditando('nueva');
          }}
        />

        {editando !== null ? (
          <CategoryForm
            inicial={editando === 'nueva' ? undefined : editando}
            padres={codigos}
            guardando={guardar.isPending}
            onGuardar={(categoria) =>
              guardar.mutate(
                editando === 'nueva' && padrePorDefecto !== null
                  ? { ...categoria, parentCode: categoria.parentCode ?? padrePorDefecto }
                  : categoria,
              )
            }
            onCancelar={() => setEditando(null)}
          />
        ) : null}

        {categorias.isPending ? (
          <p className="categoria-vacio">Cargando el catálogo…</p>
        ) : categorias.isError ? (
          <p className="categoria-vacio">No se pudo leer el catálogo de categorías.</p>
        ) : (
          <CategoryTree
            categorias={lista}
            control={control}
            onEditar={(categoria) => {
              setPadrePorDefecto(null);
              setEditando(categoria);
            }}
            onDesactivar={(categoria) => desactivar.mutate(categoria.code)}
            onAgregarHija={(parentCode) => {
              setPadrePorDefecto(parentCode);
              setEditando('nueva');
            }}
          />
        )}
      </Panel>

      <Panel title="Inyección masiva">
        <CategoryImportPanel
          ocupado={inyectar.isPending}
          resumen={resumen}
          catalogo={lista}
          onProbar={(categoriasJson) => inyectar.mutate({ lista: categoriasJson, seco: true })}
          onInyectar={(categoriasJson) => inyectar.mutate({ lista: categoriasJson, seco: false })}
        />
      </Panel>
    </div>
  );
}
