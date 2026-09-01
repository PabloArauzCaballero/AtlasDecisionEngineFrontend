'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { Tabs } from '../components/Tabs';
import { useTabParam } from '../components/useTabParam';
import { WorkerViewPanel } from '../features/workers/WorkerViewPanel';
import { workerMenuEntry } from '../features/workers/worker-menu';
import { resolveView, viewsFor, type TabCode } from '../features/workers/worker-views';
import { fetchWorkerCatalog } from '../features/workers/workers.api';

/**
 * La pantalla de UN worker: la que la ruta nombró.
 *
 * Antes era un concentrador con los cinco: una fila de pestañas para elegir
 * worker y, dentro de cada una, OTRA fila para elegir qué mirar de él. Dos
 * jerarquías planas seguidas, y la de arriba —la que manda— escondida dentro
 * del contenido, donde no se puede enlazar ni marcar como favorita aunque cada
 * worker tuviera su ruta desde el principio.
 *
 * Elegir worker se mudó al menú lateral, que es donde vive lo que cambia de
 * página (ver `navigation-tail.ts`). Aquí queda una sola fila de pestañas —las
 * caras del worker— y el título de la página vuelve a ser el nombre del worker,
 * que es lo que el enlace compartido anuncia.
 */
export function WorkersPage({ initialWorker }: { initialWorker?: TabCode }) {
  const catalog = useQuery({
    queryKey: ['worker-catalog'],
    queryFn: ({ signal }) => fetchWorkerCatalog(signal),
  });

  // `/workers` a secas sigue siendo ruta válida —enlaces guardados, el tutorial,
  // el permiso que ya existe— y entra al primero de la lista.
  const current = workerMenuEntry(initialWorker);
  const views = viewsFor(current.code);

  const [requestedView, setView] = useTabParam(
    views.map((view) => view.id),
    views[0].id,
    'vista',
  );
  const activeView = resolveView(current.code, requestedView);
  const descriptor = catalog.data?.find((item) => item.code === current.code);

  return (
    <>
      <PageHeader
        eyebrow="Procesamiento · Workers"
        title={current.label}
        description={descriptor?.description ?? current.fallbackDescription}
        hint={current.hint}
      />

      <div data-tutorial-id="workers-switch">
        <Tabs
          className="worker-views"
          idPrefix={`worker-${current.code}`}
          tabs={views.map((view) => ({ ...view }))}
          active={activeView}
          onChange={setView}
        >
          {(viewId) => (
            <WorkerViewPanel
              worker={current.code}
              view={viewId}
              // La pestaña que no se ve sigue montada para conservar su estado:
              // que no siga además preguntándole al motor.
              active={viewId === activeView}
              descriptor={descriptor}
              catalogLoading={catalog.isLoading}
            />
          )}
        </Tabs>
      </div>
    </>
  );
}
