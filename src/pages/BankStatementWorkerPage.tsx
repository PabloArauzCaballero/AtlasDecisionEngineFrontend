'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
  downloadStatement,
  fetchFixtures,
  fetchWorkerCatalog,
  type StatementFormat,
} from '../features/workers/workers.api';
import type { WorkerDescriptor } from '../features/workers/worker-types';
import { useNotifications } from '../notifications/useNotifications';
import { saveBlob } from '../utils/download';

const WORKER = 'bank-statement' as const;

const DESCARGAS: ReadonlyArray<{ format: StatementFormat; label: string }> = [
  { format: 'csv', label: 'Descargar CSV' },
  { format: 'json', label: 'Movimientos (JSON)' },
  { format: 'normalized', label: 'Contrato completo' },
];

/**
 * Consola de extractos: subir un PDF y obtener sus movimientos normalizados.
 *
 * El documento no se conserva: el motor lo borra en cuanto hay resultado. La
 * vista lo dice de forma explícita, porque quien sube un extracto propio tiene
 * derecho a saber qué pasa con él.
 *
 * Sin cabecera propia: vive dentro de la pestaña «Consola» de `WorkersPage`.
 */
export function BankStatementWorkerConsole() {
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

  const descargar = useMutation({
    mutationFn: (format: StatementFormat) => downloadStatement(requestId as string, format),
    onSuccess: (archivo) => saveBlob(archivo.fileName, archivo.blob),
    onError: (error: Error) =>
      notify({
        tone: 'error',
        title: 'No se pudo descargar',
        description: error.message,
      }),
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
    // Contenedor propio por lo mismo que en la consola semántica: el panel de
    // control sigue montado al lado y comparte vocabulario con esta vista.
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
                   * Botones y no enlaces: un `<a href="/v1/…">` es una navegación
                   * del navegador y ahí no viaja el token de la sesión, que esta
                   * aplicación guarda en memoria. Los tres devolvían 401 y el
                   * usuario se llevaba el error como archivo. El nombre lo sigue
                   * decidiendo el servidor por `Content-Disposition`.
                   */}
                  {DESCARGAS.map(({ format, label }) => (
                    <button
                      key={format}
                      type="button"
                      className="btn ghost"
                      disabled={descargar.isPending}
                      onClick={() => descargar.mutate(format)}
                    >
                      {label}
                    </button>
                  ))}
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
    </div>
  );
}
