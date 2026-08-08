'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Panel } from '../components/Panel';
import { WorkerHeaderFacts } from '../features/workers/WorkerHeaderFacts';
import { WorkerInputChoice } from '../features/workers/WorkerInputChoice';
import { WorkerRunTracker } from '../features/workers/WorkerRunTracker';
import { useWorkerRun } from '../features/workers/useWorkerRun';
import {
  cancelRun,
  createSemanticRun,
  fetchFixtures,
  fetchWorkerCatalog,
} from '../features/workers/workers.api';
import type { WorkerDescriptor } from '../features/workers/worker-types';
import { useNotifications } from '../notifications/useNotifications';
import { SemanticResultView } from '../features/workers/SemanticResultView';

const WORKER = 'semantic-analysis' as const;

/**
 * Consola del análisis semántico: enviar un texto y ver su clasificación.
 *
 * La ejecución es asíncrona: esta vista encola y sigue, no espera. Por eso el
 * botón de ejecutar desaparece en cuanto hay una ejecución en curso, en vez de
 * quedarse deshabilitado — un botón gris invita a volver a pulsarlo.
 *
 * No pinta cabecera de página: vive dentro de la pestaña «Consola» de
 * `WorkersPage`, que ya dice de qué worker se trata. Dos títulos seguidos
 * repetirían lo mismo y empujarían el formulario fuera de la primera pantalla.
 */
export function SemanticAnalysisWorkerConsole() {
  const { notify } = useNotifications();
  const [mode, setMode] = useState<'fixture' | 'own'>('fixture');
  const [text, setText] = useState('');
  const [fixtureCode, setFixtureCode] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);

  const catalog = useQuery({
    queryKey: ['worker-catalog'],
    queryFn: ({ signal }) => fetchWorkerCatalog(signal),
  });
  const descriptor: WorkerDescriptor | undefined = catalog.data?.find(
    (item) => item.code === WORKER,
  );

  const fixtures = useQuery({
    queryKey: ['worker-fixtures', WORKER],
    queryFn: ({ signal }) => fetchFixtures(WORKER, signal),
    enabled: descriptor?.fixturesEnabled === true,
  });

  const run = useWorkerRun(WORKER, requestId);

  const submit = useMutation({
    mutationFn: () =>
      createSemanticRun(mode === 'fixture' ? { fixtureCode } : { text: text.trim() }),
    onSuccess: (created) => {
      setRequestId(created.requestId);
      notify({
        tone: 'success',
        title: 'Análisis encolado',
        description: 'El resultado aparecerá abajo en cuanto un worker lo procese.',
      });
    },
    // Los errores de mutación los reporta el `MutationCache` global; aquí sólo
    // se añade el éxito, como en el resto del portal.
  });

  const cancel = useMutation({
    mutationFn: () => cancelRun(WORKER, requestId as string),
    onSuccess: () =>
      notify({
        tone: 'success',
        title: 'Ejecución cancelada',
        description: 'No llegó a procesarse.',
      }),
  });

  const maxLength = Number(descriptor?.limits?.maxTextLength ?? 8_000);
  const trimmed = text.trim();
  const canSubmit =
    descriptor?.available === true &&
    (mode === 'fixture' ? fixtureCode !== '' : trimmed.length > 0 && text.length <= maxLength);

  function reset() {
    setRequestId(null);
    setText('');
    setFixtureCode('');
  }

  return (
    /*
     * Un contenedor propio, no un fragmento: la pestaña «Panel de control»
     * sigue montada al lado (oculta, para conservar su estado) y comparte
     * vocabulario con ésta —«En cola», «Completado con advertencias»—. Sin una
     * raíz que las separe, cualquier búsqueda por texto encuentra las dos.
     */
    <div className="worker-console">
      <WorkerHeaderFacts descriptor={descriptor} loading={catalog.isLoading} />

      <Panel
        title="Entrada"
        className="worker-entry"
        meta={descriptor?.available ? undefined : 'Worker no disponible'}
      >
        <WorkerInputChoice
          mode={mode}
          onModeChange={setMode}
          fixturesEnabled={descriptor?.fixturesEnabled === true}
          fixtures={fixtures.data ?? []}
          selectedFixture={fixtureCode}
          onFixtureChange={setFixtureCode}
          ownLabel="Escribir un texto"
          disabled={requestId !== null}
        >
          <label className="field">
            <span className="field-label" id="worker-text-label">
              Texto a analizar
            </span>
            <textarea
              className="worker-textarea"
              rows={7}
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={requestId !== null}
              aria-labelledby="worker-text-label"
              aria-describedby="worker-text-help"
              placeholder="Pega aquí el texto que quieres clasificar."
            />
            <small
              id="worker-text-help"
              className={text.length > maxLength ? 'field-help is-error' : 'field-help'}
            >
              {text.length.toLocaleString('es-BO')} de {maxLength.toLocaleString('es-BO')}{' '}
              caracteres
              {text.length > maxLength ? ' — excede el máximo permitido' : ''}
            </small>
          </label>
        </WorkerInputChoice>

        {requestId === null ? (
          <div className="worker-run-actions">
            <button
              type="button"
              className="btn primary"
              disabled={!canSubmit || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Enviando…' : 'Analizar'}
            </button>
            {descriptor && !descriptor.available ? (
              <p className="field-help">
                Este worker está apagado en el entorno actual. Puedes consultar ejecuciones
                anteriores, pero no crear nuevas.
              </p>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {requestId && run.data ? (
        <Panel title="Ejecución">
          <WorkerRunTracker
            run={run.data}
            onCancel={() => cancel.mutate()}
            cancelling={cancel.isPending}
            onReset={reset}
          />
        </Panel>
      ) : null}

      {run.data?.result ? (
        <Panel title="Resultado">
          <SemanticResultView result={run.data.result} />
        </Panel>
      ) : null}
    </div>
  );
}
