'use client';

import { useQuery } from '@tanstack/react-query';
import { AudioLines, FileSpreadsheet, FileText, ScanFace, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Tabs } from '../components/Tabs';
import { useTabParam } from '../components/useTabParam';
import { IdentityReviewQueue } from '../features/workers/IdentityReviewQueue';
import { StatementReviewQueue } from '../features/workers/StatementReviewQueue';
import { UnresolvedConsole } from '../features/workers/UnresolvedConsole';
import { WorkerCategoriesConsole } from '../features/workers/WorkerCategoriesConsole';
import { WorkerDashboard } from '../features/workers/WorkerDashboard';
import type { WorkerDescriptor } from '../features/workers/worker-types';
import {
  GENERADOR_DOCUMENTAL,
  resolveView,
  viewsFor,
  WORKER_VIEWS,
  type TabCode,
} from '../features/workers/worker-views';
import { fetchWorkerCatalog, type WorkerCode } from '../features/workers/workers.api';
import { DocumentGeneratorConsole } from '../features/documents/DocumentGeneratorConsole';
import { DocumentGeneratorPanel } from '../features/documents/DocumentGeneratorPanel';
import { AudioTtsWorkerConsole } from './AudioTtsWorkerPage';
import { BankStatementWorkerConsole } from './BankStatementWorkerPage';
import { IdentityVerificationWorkerConsole } from './IdentityVerificationWorkerPage';
import { SemanticAnalysisWorkerConsole } from './SemanticAnalysisWorkerPage';

/**
 * Los cuatro workers, bajo una sola entrada de navegación.
 *
 * Antes eran vistas sueltas en el cajón, cada una con su formulario y nada
 * más: se podía lanzar trabajo pero no saber si el worker estaba sano, qué
 * tenía en cola ni con qué fallaba. Aquí cada worker es una pestaña con dos
 * caras —el panel de control y la consola— porque son las dos preguntas que se
 * hacen delante de un servicio asíncrono: «¿está bien?» y «procesa esto».
 *
 * El título de la página es el del worker elegido, no un genérico «Workers»: es
 * lo que se está mirando, y es lo que el enlace compartido tiene que anunciar.
 */

interface WorkerTab {
  code: TabCode;
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
  {
    code: 'identity-verification',
    label: 'Verificación de Identidad',
    icon: ScanFace,
    fallbackDescription:
      'Compara la foto de un documento de identidad con una selfie y decide si son la misma persona.',
    hint: 'Sube la foto del documento y una selfie: obtienes el veredicto, los datos leídos del documento —con el número enmascarado— y la evidencia que lo sostiene. Las imágenes no se conservan.',
  },
  {
    code: 'audio-tts',
    label: 'Locución',
    icon: AudioLines,
    fallbackDescription:
      'Convierte en voz una plantilla del catálogo, rellenando sus variables. Una frase ya locutada con la misma voz se sirve de caché.',
    hint: 'Elige qué debe decirse y con qué valores: obtienes el audio, la voz con la que se dijo y si costó generarlo o ya estaba. El texto locutado se guarda cifrado y no se publica.',
  },
  {
    code: GENERADOR_DOCUMENTAL,
    label: 'Documentos PDF',
    icon: FileText,
    fallbackDescription:
      'Genera un PDF maquetado a partir de una plantilla del catálogo y los datos que declara su contrato.',
    hint: 'Entregas datos estructurados y recibes el documento con el membrete, el pie y la numeración puestos. Los campos que pide cada documento los publica el propio motor: esta pantalla no los conoce de antemano.',
  },
];

export function WorkersPage({ initialWorker }: { initialWorker?: TabCode }) {
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
    WORKER_VIEWS.map((view) => view.id),
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
              tabs={viewsFor(workerId as TabCode).map((view) => ({ ...view }))}
              active={resolveView(workerId as TabCode, activeView)}
              onChange={setActiveView}
            >
              {(viewId) =>
                viewId === 'panel' && workerId === GENERADOR_DOCUMENTAL ? (
                  <div data-tutorial-id="workers-dashboard">
                    <DocumentGeneratorPanel
                      active={workerId === activeWorker && activeView === 'panel'}
                    />
                  </div>
                ) : viewId === 'panel' ? (
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
                ) : viewId === 'pendientes' ? (
                  <div data-tutorial-id="workers-unresolved">
                    <UnresolvedConsole />
                  </div>
                ) : viewId === 'categorias' ? (
                  <div data-tutorial-id="workers-categories">
                    <WorkerCategoriesConsole />
                  </div>
                ) : viewId === 'revision' ? (
                  <div data-tutorial-id="workers-review">
                    {/*
                     * Dos bandejas y no una genérica: los casos no se parecen —un
                     * parecido entre umbrales frente a un documento cuya clase no
                     * se pudo confirmar— y tampoco las acciones que los cierran.
                     */}
                    {workerId === 'bank-statement' ? (
                      <StatementReviewQueue
                        active={workerId === activeWorker && activeView === 'revision'}
                      />
                    ) : (
                      <IdentityReviewQueue
                        active={workerId === activeWorker && activeView === 'revision'}
                      />
                    )}
                  </div>
                ) : workerId === 'semantic-analysis' ? (
                  <div data-tutorial-id="workers-console">
                    <SemanticAnalysisWorkerConsole />
                  </div>
                ) : workerId === 'identity-verification' ? (
                  <div data-tutorial-id="workers-console">
                    <IdentityVerificationWorkerConsole />
                  </div>
                ) : workerId === 'audio-tts' ? (
                  <div data-tutorial-id="workers-console">
                    <AudioTtsWorkerConsole />
                  </div>
                ) : workerId === GENERADOR_DOCUMENTAL ? (
                  <div data-tutorial-id="workers-console">
                    <DocumentGeneratorConsole />
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
