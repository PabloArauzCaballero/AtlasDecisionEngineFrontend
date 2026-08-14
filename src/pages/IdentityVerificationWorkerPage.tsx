'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import { ForceFreshRun } from '../features/workers/ForceFreshRun';
import { IdentityImagePicker } from '../features/workers/IdentityImagePicker';
import { IdentityResultView } from '../features/workers/IdentityResultView';
import { WorkerHeaderFacts } from '../features/workers/WorkerHeaderFacts';
import { WorkerInputChoice } from '../features/workers/WorkerInputChoice';
import { WorkerRunTracker } from '../features/workers/WorkerRunTracker';
import { useWorkerRun } from '../features/workers/useWorkerRun';
import type { WorkerDescriptor } from '../features/workers/worker-types';
import {
  cancelRun,
  createIdentityVerificationRun,
  fetchFixtures,
  fetchWorkerCatalog,
} from '../features/workers/workers.api';
import type { IdentityOutcome } from '../features/workers/identity-types';
import { isTerminal } from '../features/workers/worker-types';
import { useUnsavedWork } from '../navigation/UnsavedWorkProvider';
import { useNotifications } from '../notifications/useNotifications';
import { asRecord } from '../utils/records';

const WORKER = 'identity-verification' as const;

/**
 * Consola de verificación de identidad: dos fotos y un veredicto.
 *
 * Las imágenes no se conservan: el motor las borra en la misma actualización
 * que cierra la ejecución. La vista lo dice de forma explícita porque quien
 * sube la foto de su cédula y su propia cara tiene derecho a saber qué pasa con
 * ellas, y porque decirlo sólo en la documentación no lo lee nadie.
 *
 * Sin cabecera propia: vive dentro de la pestaña «Consola» de `WorkersPage`.
 */
export function IdentityVerificationWorkerConsole() {
  const { notify } = useNotifications();
  const [mode, setMode] = useState<'fixture' | 'own'>('fixture');
  const [fixtureCode, setFixtureCode] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [document, setDocument] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [documentBackError, setDocumentBackError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const [forzar, setForzar] = useState(false);

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

  /*
   * El único veredicto que PIDE a una persona se ANUNCIA, no sólo se pinta.
   *
   * `REVIEW_REQUIRED` es el motor diciendo «esto lo decide alguien», y pintarlo
   * abajo del formulario sólo informa a quien lanzó la verificación y sólo en
   * ese momento: el caso quedaba sin dueño. El aviso apunta a la pestaña
   * «Revisión», que es donde el caso espera. El `ref` evita repetirlo en cada
   * sondeo de la misma ejecución.
   */
  const anunciado = useRef<string | null>(null);
  const veredicto = run.data ? (asRecord(run.data.result) as Partial<IdentityOutcome>) : null;
  useEffect(() => {
    if (requestId === null || anunciado.current === requestId) return;
    if (!run.data || !isTerminal(run.data.status)) return;
    if (veredicto?.decision !== 'REVIEW_REQUIRED') return;
    anunciado.current = requestId;
    notify({
      tone: 'warning',
      title: 'Pendiente de revisión humana',
      description:
        'El parecido quedó entre los dos umbrales calibrados. El caso espera en la pestaña «Revisión» hasta que una persona decida.',
    });
  }, [requestId, run.data, veredicto?.decision, notify]);

  /*
   * Reenviar las MISMAS imágenes devuelve la verificación que ya existe, y eso
   * es lo correcto por omisión: volver a leer y volver a comparar gasta trabajo
   * sin cambiar el veredicto. El motor recalcula solo cuando cambia algo que
   * puede cambiarlo —la calibración o la versión del canal de lectura—.
   *
   * Esta casilla es la vía de escape para el resto de casos: una foto mejor
   * hecha del mismo documento, o querer comprobar a mano que el resultado se
   * reproduce. Manda una clave nueva, que es lo que el motor documenta para
   * volver a preguntar. Sin ella, la pantalla no tenía forma de pedir una
   * lectura nueva y un resultado guardado se leía como un arreglo que no sirvió.
   */
  const submit = useMutation({
    mutationFn: () =>
      createIdentityVerificationRun(
        mode === 'fixture'
          ? { fixtureCode, ...(forzar ? { idempotencyKey: crypto.randomUUID() } : {}) }
          : {
              document: document ?? undefined,
              documentBack: documentBack ?? undefined,
              selfie: selfie ?? undefined,
              ...(forzar ? { idempotencyKey: crypto.randomUUID() } : {}),
            },
      ),
    onSuccess: (created) => {
      setRequestId(created.requestId);
      notify({
        tone: 'success',
        title: 'Verificación encolada',
        description: 'El veredicto aparecerá abajo en cuanto un worker la procese.',
      });
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelRun(WORKER, requestId as string),
    onSuccess: () =>
      notify({
        tone: 'success',
        title: 'Verificación cancelada',
        description: 'No llegó a procesarse y las imágenes se borraron.',
      }),
  });

  const maxBytes = Number(descriptor?.limits?.maxUploadBytes ?? 10_485_760);
  const canSubmit =
    descriptor?.available === true &&
    (mode === 'fixture'
      ? fixtureCode !== ''
      : document !== null &&
        selfie !== null &&
        documentError === null &&
        selfieError === null &&
        documentBackError === null);

  function reset() {
    setRequestId(null);
    setFixtureCode('');
    setDocument(null);
    setDocumentBack(null);
    setSelfie(null);
    setDocumentError(null);
    setDocumentBackError(null);
    setSelfieError(null);
  }

  // Duele perder dos fotos ya elegidas y sin enviar: volver a buscarlas —o a
  // hacerlas— es trabajo, y en un móvil es rehacer la captura entera.
  useUnsavedWork(
    requestId === null && (document !== null || selfie !== null),
    'Imágenes elegidas en la consola de Verificación de Identidad, sin enviar.',
  );

  /**
   * Sin perfil calibrado, el motor manda TODO a revisión manual. Se avisa antes
   * de mandar las fotos: descubrirlo en el veredicto parece un fallo del worker
   * cuando es una configuración que falta.
   */
  const sinUmbrales =
    descriptor !== undefined &&
    String(descriptor.limits?.thresholdProfile ?? '') === 'unconfigured';

  return (
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
          ownLabel="Cargar mis propias imágenes"
          disabled={requestId !== null}
        >
          <IdentityImagePicker
            document={{ file: document, error: documentError }}
            documentBack={{ file: documentBack, error: documentBackError }}
            selfie={{ file: selfie, error: selfieError }}
            maxBytes={maxBytes}
            disabled={requestId !== null}
            onDocumentChange={(file, error) => {
              setDocument(file);
              setDocumentError(error);
            }}
            onDocumentBackChange={(file, error) => {
              setDocumentBack(file);
              setDocumentBackError(error);
            }}
            onSelfieChange={(file, error) => {
              setSelfie(file);
              setSelfieError(error);
            }}
          />
        </WorkerInputChoice>

        {requestId === null ? (
          <div className="worker-run-actions">
            <ForceFreshRun
              checked={forzar}
              onChange={setForzar}
              label="Forzar una verificación nueva"
              help="Sin marcar, reenviar las mismas imágenes devuelve la verificación que ya existe. El motor vuelve a leerlas solo si cambió la calibración o el canal de lectura."
            />
            <button
              type="button"
              className="button button-primary"
              disabled={!canSubmit || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Enviando…' : 'Verificar'}
            </button>
            {descriptor && !descriptor.available ? (
              <p className="field-help">
                Este worker está apagado en el entorno actual. Puedes consultar verificaciones
                anteriores, pero no crear nuevas.
              </p>
            ) : null}
            {sinUmbrales ? (
              <p className="field-help" role="status">
                Este motor no tiene umbrales biométricos calibrados, así que toda verificación
                terminará en <strong>revisión manual</strong>. No es un fallo: es lo que hace el
                worker cuando nadie firmó una calibración.
              </p>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {requestId && run.data ? (
        <Panel title="Ejecución">
          <WorkerRunTracker
            worker={WORKER}
            run={run.data}
            onCancel={() => cancel.mutate()}
            cancelling={cancel.isPending}
            onReset={reset}
          />
        </Panel>
      ) : null}

      {run.data?.result ? (
        <Panel title="Veredicto">
          <IdentityResultView result={run.data.result} />
        </Panel>
      ) : null}
    </div>
  );
}
