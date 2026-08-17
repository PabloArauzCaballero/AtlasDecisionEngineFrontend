'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { StatementReviewFilters } from './StatementReviewFilters';
import { StatementReviewCase } from './StatementReviewCase';
import {
  fetchStatementReviewCategories,
  fetchStatementReviews,
  type StatementReviewQuery,
} from './statement-review.api';
import {
  pendingLabel,
  REVIEW_REASON_HELP,
  REVIEW_REASON_LABEL,
  type StatementReviewCategory,
  type StatementReviewReason,
} from './statement-review';

/** Cuántos casos por página. El motor la impone igual; esto es la petición. */
const PAGE_SIZE = 20;

/**
 * Pendientes de revisión de extractos.
 *
 * Existe como PESTAÑA propia y visible, no como un filtro escondido dentro del
 * historial: un caso que sólo aparece si alguien sabe qué combinación de filtros
 * marcar es un caso decidido por nadie. Y está organizada por categorías porque
 * una tabla única con todo mezclado no se trabaja — «timeout» se resuelve
 * reprocesando y «documento dudoso» se resuelve mirando el PDF, y son dos
 * tardes distintas.
 *
 * Lo que NUNCA aparece aquí son los documentos rechazados. El motor no los
 * devuelve por esta ruta, así que la garantía no depende de que esta pantalla se
 * acuerde de filtrarlos: `PDF_INVALID` vive en el historial, marcado como
 * rechazado, y la cola se puede leer entera.
 */
export function StatementReviewQueue({ active }: { active: boolean }) {
  const [category, setCategory] = useState<StatementReviewReason | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<StatementReviewQuery>({});

  const categorias = useQuery({
    queryKey: ['statement-review-categories'],
    queryFn: ({ signal }) => fetchStatementReviewCategories(signal),
    // La pestaña que no se ve sigue montada para conservar su estado: que no
    // siga además preguntándole al motor.
    enabled: active,
    refetchInterval: active ? 30_000 : false,
  });

  const cola = useQuery({
    queryKey: ['statement-reviews', category, page, filters],
    queryFn: ({ signal }) =>
      fetchStatementReviews(
        { ...filters, category: category ?? undefined, page, pageSize: PAGE_SIZE },
        signal,
      ),
    enabled: active,
    refetchInterval: active ? 30_000 : false,
  });

  const tabs = categorias.data ?? [];
  const items = cola.data?.items ?? [];
  const total = cola.data?.total ?? 0;
  const totalPages = cola.data?.totalPages ?? 1;

  function elegirCategoria(valor: StatementReviewReason | null) {
    setCategory(valor);
    // Cambiar de pestaña vuelve a la primera página: quedarse en la 7 de una
    // categoría que tiene 2 enseña una lista vacía que se lee como «no hay nada».
    setPage(1);
  }

  return (
    <div className="worker-console">
      <Panel
        title="Pendientes de revisión"
        meta={total > 0 ? `${String(total)} por decidir` : undefined}
      >
        <p className="field-help">
          Documentos que el motor no resolvió solo porque la duda era real. Lo que claramente no era
          un extracto bancario no está aquí: se rechaza en el momento y queda en el historial como{' '}
          <strong>PDF no válido</strong>. Esta cola es sólo para casos ambiguos.
        </p>

        <CategoryTabs categorias={tabs} activa={category} onElegir={elegirCategoria} />

        {category ? <p className="field-help">{REVIEW_REASON_HELP[category]}</p> : null}

        <StatementReviewFilters
          value={filters}
          onChange={(siguiente) => {
            setFilters(siguiente);
            setPage(1);
          }}
        />

        {cola.isPending && active ? (
          <p className="categoria-vacio">Cargando la cola…</p>
        ) : cola.isError ? (
          <p className="categoria-vacio">No se pudo leer la cola de revisión del motor.</p>
        ) : items.length === 0 ? (
          <p className="categoria-vacio">
            {category
              ? `No hay nada pendiente en «${REVIEW_REASON_LABEL[category]}».`
              : 'No hay documentos esperando a una persona.'}
          </p>
        ) : (
          <ul className="revision-lista">
            {items.map((item) => (
              <StatementReviewCase key={item.requestId} item={item} />
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <nav className="revision-paginacion" aria-label="Páginas de la cola de revisión">
            <button
              type="button"
              className="button"
              disabled={page <= 1 || cola.isFetching}
              onClick={() => setPage((actual) => Math.max(1, actual - 1))}
            >
              Anterior
            </button>
            {/*
             * El total viene del motor y no de contar lo cargado: la página trae
             * 20 casos y decir «20 pendientes» sobre una cola de cuatrocientos es
             * la forma de que nadie sepa que hay más.
             */}
            <span className="revision-paginacion-estado">
              Página {String(page)} de {String(totalPages)} · {String(total)} casos
            </span>
            <button
              type="button"
              className="button"
              disabled={!cola.data?.hasNextPage || cola.isFetching}
              onClick={() => setPage((actual) => actual + 1)}
            >
              Siguiente
            </button>
          </nav>
        ) : null}
      </Panel>
    </div>
  );
}

/**
 * Las pestañas de categoría, con su contador.
 *
 * No se usa el componente `Tabs` del portal a propósito: aquél monta el
 * contenido de cada pestaña por separado para conservar su estado, y aquí las
 * nueve pestañas comparten una sola lista que se vuelve a pedir al motor. Serían
 * nueve consultas en vuelo para enseñar una.
 */
function CategoryTabs({
  categorias,
  activa,
  onElegir,
}: {
  categorias: readonly StatementReviewCategory[];
  activa: StatementReviewReason | null;
  onElegir: (categoria: StatementReviewReason | null) => void;
}) {
  return (
    <div className="revision-categorias" role="tablist" aria-label="Categorías de pendientes">
      {categorias.map((categoria) => {
        const seleccionada = categoria.category === activa;
        const etiqueta = categoria.category ? REVIEW_REASON_LABEL[categoria.category] : 'Todos';
        return (
          <button
            key={categoria.category ?? 'todos'}
            type="button"
            role="tab"
            aria-selected={seleccionada}
            className="revision-categoria"
            data-activa={seleccionada ? 'true' : undefined}
            onClick={() => onElegir(categoria.category)}
            title={
              categoria.oldestPendingMs === null
                ? undefined
                : `El más antiguo lleva ${pendingLabel(categoria.oldestPendingMs)}`
            }
          >
            {etiqueta}
            <span className="revision-categoria-cuenta">{String(categoria.total)}</span>
          </button>
        );
      })}
    </div>
  );
}
