'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Repeat } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { useNotifications } from '../../notifications/useNotifications';
import { fetchCategories } from './categories.api';
import { UnresolvedBulk } from './UnresolvedBulk';
import { FilaPendiente } from './UnresolvedRow';
import {
  fetchReevaluationState,
  fetchUnresolved,
  reevaluateUnresolved,
  resolveUnresolved,
  type ReevaluationSummary,
  type ResolutionType,
} from './unresolved.api';

/**
 * Bandeja de valores pendientes de clasificar.
 *
 * Lo primero que enseña de cada caso es **el valor tal como llegó** y **cuántas
 * veces apareció**, en ese orden. No es estética: un término que salió 40 veces
 * cuesta 40 movimientos sin categoría, y ordenar por frecuencia es lo que
 * convierte una lista larga en una tarde de trabajo útil.
 *
 * La recomendación del motor va con su confianza a la vista y con un botón que
 * la acepta de un clic. Las alternativas están al lado porque cuando la primera
 * falla, la respuesta casi siempre es la segunda.
 */
export function UnresolvedConsole() {
  const cliente = useQueryClient();
  const { notify } = useNotifications();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('');

  /** El último resumen anunciado, para no repetir el aviso en cada refresco. */
  const anunciado = useRef<ReevaluationSummary | null>(null);

  /*
   * La pasada corre en el motor y esto la vigila. Mientras corra, la bandeja se
   * relee cada pocos segundos: las filas van desapareciendo a medida que el
   * catálogo las cierra, que es la forma honesta de enseñar que algo ocurre.
   */
  const estado = useQuery({
    queryKey: ['unresolved-reevaluacion'],
    queryFn: ({ signal }) => fetchReevaluationState(signal),
    refetchInterval: (consulta) => (consulta.state.data?.corriendo === true ? 4_000 : false),
  });
  const corriendo = estado.data?.corriendo === true;

  const pendientes = useQuery({
    queryKey: ['unresolved', filtro],
    queryFn: ({ signal }) => fetchUnresolved(filtro, signal),
    refetchInterval: corriendo ? 6_000 : false,
  });
  const categorias = useQuery({
    queryKey: ['semantic-categories'],
    queryFn: ({ signal }) => fetchCategories(signal),
  });

  const hojas = useMemo(
    () =>
      (categorias.data ?? [])
        .filter((categoria) => categoria.isActive && categoria.acceptanceThreshold < 1)
        .map((categoria) => categoria.code),
    [categorias.data],
  );

  const resolver = useMutation({
    mutationFn: ({
      id,
      resolutionType,
      categoryCode,
    }: {
      id: string;
      resolutionType: ResolutionType;
      categoryCode?: string;
    }) => resolveUnresolved(id, { resolutionType, categoryCode }),
    onSuccess: async (_resultado, variables) => {
      notify({
        tone: 'success',
        title: 'Pendiente resuelto',
        description:
          variables.resolutionType === 'DISCARD'
            ? 'Se descartó sin enseñar nada al catálogo.'
            : 'El motor aprendió el alias: este valor ya no volverá a preguntarse.',
      });
      await cliente.invalidateQueries({ queryKey: ['unresolved'] });
    },
  });

  /*
   * Un pendiente se abre porque el catálogo de ENTONCES no supo decidir, y la
   * causa más común es que faltaba la categoría o su vocabulario. Sembrar el
   * catálogo no vacía la bandeja sola, así que ésta acumulaba términos que el
   * motor ya sabe clasificar y seguía pidiendo asignarlos a mano, uno por uno.
   * Esto vuelve a preguntar por todos con el catálogo de hoy.
   */
  useEffect(() => {
    if (corriendo) return;
    const resumen = estado.data?.ultima;
    if (!resumen || resumen === anunciado.current) return;
    anunciado.current = resumen;
    notify({
      tone: 'success',
      title: `${String(resumen.resueltos)} de ${String(resumen.revisados)} se resolvieron solos`,
      description:
        resumen.resueltos === 0
          ? `El catálogo actual no cierra ninguno. ${String(resumen.refrescados)} quedan con la recomendación puesta al día.`
          : `El catálogo actual ya los clasifica. Quedan ${String(resumen.pendientes)} para decidir a mano.`,
    });
    void cliente.invalidateQueries({ queryKey: ['unresolved'] });
  }, [corriendo, estado.data?.ultima, notify, cliente]);

  const reevaluar = useMutation({
    mutationFn: () => reevaluateUnresolved(),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: ['unresolved-reevaluacion'] });
    },
  });

  const lista = pendientes.data ?? [];

  return (
    <div className="pendientes">
      <Panel
        title="Pendientes de clasificación"
        meta={lista.length > 0 ? `${String(lista.length)} sin resolver` : undefined}
      >
        <p className="field-help">
          Valores que el motor recibió y no pudo asignar con confianza suficiente. No se inventa
          ninguna categoría y no se pierde el dato: aquí se decide, y la decisión queda aprendida
          como alias para que el mismo valor no vuelva a preguntarse.
        </p>

        <form
          className="pendientes-busqueda"
          onSubmit={(evento) => {
            evento.preventDefault();
            setFiltro(busqueda);
          }}
        >
          <label className="field">
            <span className="sr-only">Buscar un valor pendiente</span>
            <input
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por el texto recibido…"
            />
          </label>
          <button type="submit" className="button">
            <Search size={15} aria-hidden="true" /> Buscar
          </button>
          <button
            type="button"
            className="button"
            disabled={reevaluar.isPending || corriendo || lista.length === 0}
            onClick={() => reevaluar.mutate()}
          >
            <Repeat size={15} aria-hidden="true" />
            {corriendo
              ? `Reevaluando… quedan ${String(estado.data?.pendientes ?? 0)}`
              : 'Reevaluar con el catálogo actual'}
          </button>
        </form>

        <UnresolvedBulk
          pendientes={lista}
          categorias={categorias.data ?? []}
          onAplicar={async (asignaciones) => {
            /*
             * En serie y no en paralelo: cada resolución escribe un alias en el
             * catálogo, y treinta escrituras simultáneas sobre la misma tabla
             * compiten por la unicidad `(tenant, tipo, alias)` sin ganar nada:
             * esto es una tarea de mantenimiento, no una ruta caliente.
             */
            let hechas = 0;
            for (const asignacion of asignaciones) {
              await resolveUnresolved(asignacion.id, {
                resolutionType: 'ASSIGN_EXISTING',
                categoryCode: asignacion.categoryCode,
              });
              hechas += 1;
            }
            notify({
              tone: 'success',
              title: `${String(hechas)} pendientes resueltos`,
              description: 'El motor aprendió un alias por cada uno: no volverán a preguntarse.',
            });
            await cliente.invalidateQueries({ queryKey: ['unresolved'] });
          }}
        />

        {pendientes.isPending ? (
          <p className="categoria-vacio">Cargando la bandeja…</p>
        ) : pendientes.isError ? (
          <p className="categoria-vacio">No se pudo leer la bandeja de pendientes.</p>
        ) : lista.length === 0 ? (
          <p className="categoria-vacio">
            No hay nada pendiente. Cada valor que el motor recibió encontró su categoría.
          </p>
        ) : (
          <ul className="pendientes-lista">
            {lista.map((item) => (
              <FilaPendiente
                key={item.id}
                item={item}
                hojas={hojas}
                ocupado={resolver.isPending}
                onResolver={(resolutionType, categoryCode) =>
                  resolver.mutate({ id: item.id, resolutionType, categoryCode })
                }
              />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
