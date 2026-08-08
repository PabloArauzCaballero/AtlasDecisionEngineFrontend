'use client';

import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Gauge, Sparkles, SquareTerminal } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Tabs } from '../components/Tabs';
import { useTabParam } from '../components/useTabParam';
import { WorkerDashboard } from '../features/workers/WorkerDashboard';
import type { WorkerDescriptor } from '../features/workers/worker-types';
import { fetchWorkerCatalog, type WorkerCode } from '../features/workers/workers.api';
import { BankStatementWorkerConsole } from './BankStatementWorkerPage';
import { SemanticAnalysisWorkerConsole } from './SemanticAnalysisWorkerPage';

/**
 * Los dos workers, bajo una sola entrada de navegación.
 *
 * Antes eran dos vistas sueltas en el cajón, cada una con su formulario y nada
 * más: se podía lanzar trabajo pero no saber si el worker estaba sano, qué
 * tenía en cola ni con qué fallaba. Aquí cada worker es una pestaña con dos
 * caras —el panel de control y la consola— porque son las dos preguntas que se
 * hacen delante de un servicio asíncrono: «¿está bien?» y «procesa esto».
 *
 * El título de la página es el del worker elegido, no un genérico «Workers»: es
 * lo que se está mirando, y es lo que el enlace compartido tiene que anunciar.
 */

interface WorkerTab {
  code: WorkerCode;
  label: string;
  icon: typeof Sparkles;
  /** Qué hace, en una línea, mientras el catálogo del motor no responde. */
  fallbackDescription: string;
  hint: string;
}

const WORKERS: readonly WorkerTab[] = [
  {
    code: 'semantic-analysis',
    label: 'Análisis Semántico',
    icon: Sparkles,
    fallbackDescription:
      'Clasifica un texto libre contra el catálogo de categorías, resolviendo entidades, montos y fechas.',
    hint: 'Sirve para saber de qué trata un texto —un reclamo, una glosa, una nota— según las categorías que tu equipo definió, con la evidencia que sostiene cada decisión.',
  },
  {
    code: 'bank-statement',
    label: 'Extractos Bancarios',
    icon: FileSpreadsheet,
    fallbackDescription:
      'Convierte un extracto bancario boliviano en PDF a movimientos normalizados, con su nivel de confianza.',
    hint: 'Sube el PDF de un extracto y obtén sus movimientos en una tabla que puedes descargar. El número de cuenta se publica siempre enmascarado y el documento no se conserva.',
  },
];

const VIEWS = [
  {
    id: 'panel',
    label: 'Panel de control',
    icon: Gauge,
    hint: 'Salud, latencia, cola de procesos e incidencias de este worker.',
  },
  {
    id: 'consola',
    label: 'Consola',
    icon: SquareTerminal,
    hint: 'Enviar trabajo a este worker y ver su resultado.',
  },
] as const;

export function WorkersPage({ initialWorker }: { initialWorker?: WorkerCode }) {
  const catalog = useQuery({
    queryKey: ['worker-catalog'],
    queryFn: ({ signal }) => fetchWorkerCatalog(signal),
  });

  const [activeWorker, setActiveWorker] = useTabParam(
    WORKERS.map((worker) => worker.code),
    initialWorker ?? WORKERS[0].code,
    'worker',
  );
  const [activeView, setActiveView] = useTabParam(
    VIEWS.map((view) => view.id),
    'panel',
    'vista',
  );

  const current = WORKERS.find((worker) => worker.code === activeWorker) ?? WORKERS[0];
  const descriptorOf = (code: string): WorkerDescriptor | undefined =>
    catalog.data?.find((item) => item.code === code);
  const descriptor = descriptorOf(current.code);

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
          className="worker-switch"
          idPrefix="workers"
          tabs={WORKERS.map((worker) => ({
            id: worker.code,
            label: worker.label,
            icon: worker.icon,
            hint: descriptorOf(worker.code)?.description,
          }))}
          active={activeWorker}
          onChange={setActiveWorker}
        >
          {(workerId) => (
            <Tabs
              className="worker-views"
              idPrefix={`worker-${workerId}`}
              tabs={VIEWS.map((view) => ({ ...view }))}
              active={activeView}
              onChange={setActiveView}
            >
              {(viewId) =>
                viewId === 'panel' ? (
                  <div data-tutorial-id="workers-dashboard">
                    <WorkerDashboard
                      worker={workerId as WorkerCode}
                      descriptor={descriptorOf(workerId)}
                      catalogLoading={catalog.isLoading}
                      // La pestaña que no se ve sigue montada para conservar su
                      // estado: que no siga además preguntándole al motor.
                      active={workerId === activeWorker && activeView === 'panel'}
                    />
                  </div>
                ) : workerId === 'semantic-analysis' ? (
                  <div data-tutorial-id="workers-console">
                    <SemanticAnalysisWorkerConsole />
                  </div>
                ) : (
                  <div data-tutorial-id="workers-console">
                    <BankStatementWorkerConsole />
                  </div>
                )
              }
            </Tabs>
          )}
        </Tabs>
      </div>
    </>
  );
}
