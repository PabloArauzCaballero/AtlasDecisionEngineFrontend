'use client';

import { DocumentGeneratorConsole } from '../documents/DocumentGeneratorConsole';
import { DocumentGeneratorPanel } from '../documents/DocumentGeneratorPanel';
import { AudioTtsWorkerConsole } from '../../pages/AudioTtsWorkerPage';
import { BankStatementWorkerConsole } from '../../pages/BankStatementWorkerPage';
import { IdentityVerificationWorkerConsole } from '../../pages/IdentityVerificationWorkerPage';
import { SemanticAnalysisWorkerConsole } from '../../pages/SemanticAnalysisWorkerPage';
import { IdentityArbitrationQueue } from './IdentityArbitrationQueue';
import { IdentityReviewQueue } from './IdentityReviewQueue';
import { SemanticModelSettingsPanel } from './SemanticModelSettingsPanel';
import { StatementReviewQueue } from './StatementReviewQueue';
import { UnresolvedConsole } from './UnresolvedConsole';
import { WorkerCategoriesConsole } from './WorkerCategoriesConsole';
import { WorkerDashboard } from './WorkerDashboard';
import { WorkerInstitutionsConsole } from './WorkerInstitutionsConsole';
import type { WorkerDescriptor } from './worker-types';
import { GENERADOR_DOCUMENTAL, type TabCode } from './worker-views';
import type { WorkerCode } from './workers.api';

interface WorkerViewPanelProps {
  worker: TabCode;
  view: string;
  /** La vista que se está mirando. La oculta sigue montada, pero no consulta. */
  active: boolean;
  descriptor?: WorkerDescriptor;
  catalogLoading: boolean;
}

/**
 * Qué se pinta dentro de la pestaña elegida.
 *
 * Salió de `WorkersPage` cuando la elección de worker se mudó al menú lateral:
 * la página quedó siendo sólo cabecera y pestañas, y este reparto —seis vistas
 * que no todos los workers tienen— es lo único que quedaba largo. Separarlo
 * también deja probar el reparto sin montar la página entera.
 */
export function WorkerViewPanel({
  worker,
  view,
  active,
  descriptor,
  catalogLoading,
}: WorkerViewPanelProps) {
  if (view === 'panel') {
    // El generador documental no es un worker del motor: no comparte catálogo
    // ni métricas, así que tampoco puede compartir panel.
    return worker === GENERADOR_DOCUMENTAL ? (
      <div data-tutorial-id="workers-dashboard">
        <DocumentGeneratorPanel active={active} />
      </div>
    ) : (
      <div data-tutorial-id="workers-dashboard">
        <WorkerDashboard
          worker={worker as WorkerCode}
          descriptor={descriptor}
          catalogLoading={catalogLoading}
          active={active}
        />
      </div>
    );
  }

  if (view === 'pendientes') {
    return (
      <div data-tutorial-id="workers-unresolved">
        <UnresolvedConsole />
      </div>
    );
  }

  if (view === 'entidades') {
    return (
      <div data-tutorial-id="workers-institutions">
        <WorkerInstitutionsConsole />
      </div>
    );
  }

  if (view === 'categorias') {
    return (
      <div data-tutorial-id="workers-categories">
        <WorkerCategoriesConsole />
      </div>
    );
  }

  if (view === 'configuracion') {
    return (
      <div data-tutorial-id="workers-model-settings">
        <SemanticModelSettingsPanel active={active} />
      </div>
    );
  }

  if (view === 'revision') {
    return (
      <div data-tutorial-id="workers-review">
        {/*
         * Dos bandejas y no una genérica: los casos no se parecen —un parecido
         * entre umbrales frente a un documento cuya clase no se pudo confirmar—
         * y tampoco las acciones que los cierran.
         */}
        {worker === 'bank-statement' ? (
          <StatementReviewQueue active={active} />
        ) : (
          <>
            {/*
             * Dos poblaciones distintas en la misma pestaña, y en este orden:
             * arriba lo que PIDE una acción —documentos que la puerta no supo
             * confirmar y esperan a alguien— y debajo lo que ya tiene veredicto
             * y sólo se consulta. Mezclarlas haría que el caso accionable se
             * perdiera entre los cerrados.
             */}
            <IdentityArbitrationQueue active={active} />
            <IdentityReviewQueue active={active} />
          </>
        )}
      </div>
    );
  }

  return (
    <div data-tutorial-id="workers-console">
      {worker === 'semantic-analysis' ? (
        <SemanticAnalysisWorkerConsole />
      ) : worker === 'identity-verification' ? (
        <IdentityVerificationWorkerConsole />
      ) : worker === 'audio-tts' ? (
        <AudioTtsWorkerConsole />
      ) : worker === GENERADOR_DOCUMENTAL ? (
        <DocumentGeneratorConsole />
      ) : (
        <BankStatementWorkerConsole />
      )}
    </div>
  );
}
