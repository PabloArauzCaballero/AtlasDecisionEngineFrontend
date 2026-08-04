'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatementResultView } from '../features/workers/StatementResultView';
import { StatementUploadField } from '../features/workers/StatementUploadField';
import { WorkerHeaderFacts } from '../features/workers/WorkerHeaderFacts';
import { WorkerInputChoice } from '../features/workers/WorkerInputChoice';
import { WorkerRunTracker } from '../features/workers/WorkerRunTracker';
import { useWorkerRun } from '../features/workers/useWorkerRun';
import {
  cancelRun,
  createBankStatementRun,
  fetchFixtures,
  fetchWorkerCatalog,
  statementDownloadPath,
} from '../features/workers/workers.api';
import type { WorkerDescriptor } from '../features/workers/worker-types';
import { useNotifications } from '../notifications/useNotifications';

const WORKER = 'bank-statement' as const;

/**
 * Conversión de extractos bancarios en PDF a movimientos normalizados.
 *
 * El documento no se conserva: el motor lo borra en cuanto hay resultado. La
 * vista lo dice de forma explícita, porque quien sube un extracto propio tiene
 * derecho a saber qué pasa con él.
 */
export function BankStatementWorkerPage() {
  const { notify } = useNotifications();
  const [mode, setMode] = useState<'fixture' | 'own'>('fixture');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fixtureCode, setFixtureCode] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);

  const catalog = useQuery({
    queryKey: ['worker-catalog'],
    queryFn: ({ signal }) => fetchWorkerCatalog(signal),
  });
  const descriptor: WorkerDescriptor | undefined = catalog.data?.items?.find(
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
      createBankStatementRun(mode === 'fixture' ? { fixtureCode } : { file: file ?? undefined }),
    onSuccess: (created) => {
      setRequestId(created.requestId);
      notify({
        tone: 'success',
        title: 'Extracto encolado',
        description: 'Los movimientos aparecerán abajo en cuanto un worker lo procese.',
      });
    },
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

  const maxBytes = Number(descriptor?.limits?.maxUploadBytes ?? 10_485_760);
  const canSubmit =
    descriptor?.available === true &&
    (mode === 'fixture' ? fixtureCode !== '' : file !== null && fileError === null);

  function reset() {
    setRequestId(null);
    setFile(null);
    setFileError(null);
    setFixtureCode('');
  }

  const finished =
    run.data?.status === 'SUCCEEDED' || run.data?.status === 'SUCCEEDED_WITH_WARNINGS';

  return (
    <>
      <PageHeader
        eyebrow="Procesamiento"
        title="Extractos Bancarios"
        description="Convierte un extracto bancario boliviano en PDF a movimientos normalizados, con su nivel de confianza."
        hint="Sube el PDF de un extracto y obtén sus movimientos en una tabla que puedes descargar. El número de cuenta se publica siempre enmascarado y el documento no se conserva."
      />

      <WorkerHeaderFacts descriptor={descriptor} loading={catalog.isLoading} />

      <Panel title="Entrada" meta={descriptor?.available ? undefined : 'Worker no disponible'}>
        <WorkerInputChoice
          mode={mode}
          onModeChange={setMode}
          fixturesEnabled={descriptor?.fixturesEnabled === true}
          fixtures={fixtures.data?.items ?? []}
          selectedFixture={fixtureCode}
          onFixtureChange={setFixtureCode}
          ownLabel="Cargar mi propio PDF"
          disabled={requestId !== null}
        >
          <StatementUploadField
            file={file}
            error={fileError}
            maxBytes={maxBytes}
            disabled={requestId !== null}
            onChange={(picked, error) => {
              setFile(picked);
              setFileError(error);
            }}
          />
        </WorkerInputChoice>

        {requestId === null ? (
          <div className="worker-run-actions">
            <button
              type="button"
              className="btn primary"
              disabled={!canSubmit || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Enviando…' : 'Convertir'}
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
            actions={
              finished ? (
                <>
                  {/*
                   * Enlaces y no botones con `fetch`: la descarga la gestiona el
                   * navegador, que ya sabe nombrar el archivo a partir de
                   * `Content-Disposition` y no obliga a mantener el contenido en
                   * memoria de la pestaña.
                   */}
                  <a className="btn ghost" href={statementDownloadPath(requestId, 'csv')} download>
                    Descargar CSV
                  </a>
                  <a className="btn ghost" href={statementDownloadPath(requestId, 'json')} download>
                    Movimientos (JSON)
                  </a>
                  <a
                    className="btn ghost"
                    href={statementDownloadPath(requestId, 'normalized')}
                    download
                  >
                    Contrato completo
                  </a>
                </>
              ) : null
            }
          />
        </Panel>
      ) : null}

      {run.data?.result ? (
        <Panel title="Movimientos">
          <StatementResultView result={run.data.result} warnings={run.data.warnings} />
        </Panel>
      ) : null}
    </>
  );
}
