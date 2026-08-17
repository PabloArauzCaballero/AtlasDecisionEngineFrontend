'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { StatementCategoriesBar } from '../features/workers/StatementCategoriesBar';
import { StatementAnalytics } from '../features/workers/StatementAnalytics';
import { StatementCategoriesChart } from '../features/workers/StatementCategoriesChart';
import { StatementDownloads } from '../features/workers/StatementDownloads';
import { StatementResultView } from '../features/workers/StatementResultView';
import { StatementUploadField } from '../features/workers/StatementUploadField';
import { WorkerHeaderFacts } from '../features/workers/WorkerHeaderFacts';
import { WorkerInputChoice } from '../features/workers/WorkerInputChoice';
import { WorkerRunTracker } from '../features/workers/WorkerRunTracker';
import {
  claveMovimiento,
  useStatementCategories,
} from '../features/workers/useStatementCategories';
import { useAvisoDeRevision } from '../features/workers/useAvisoDeRevision';
import { resumirCategorias } from '../features/workers/statement-category-summary';
import { resumirExtracto } from '../features/workers/statement-analytics';
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
import { useUnsavedWork } from '../navigation/UnsavedWorkProvider';
import { useNotifications } from '../notifications/useNotifications';
import { saveBlob } from '../utils/download';
import { asRecord, asRows } from '../utils/records';

const WORKER = 'bank-statement' as const;

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

  const categorias = useStatementCategories();
  useAvisoDeRevision(categorias.enRevision);

  /*
   * Dos cosas que duele perder: un PDF ya elegido y sin convertir —volver a
   * buscarlo en el disco es trabajo—, y una clasificación en curso, que además
   * de tiempo gasta ejecuciones del worker semántico contra el limitador.
   */
  useUnsavedWork(
    requestId === null && file !== null,
    'Un PDF elegido en la consola de Extractos Bancarios, sin convertir.',
  );
  useUnsavedWork(
    categorias.corriendo,
    `Una clasificación de movimientos en curso (${categorias.hechas} de ${categorias.total} glosas).`,
  );
  /*
   * Los movimientos que se clasifican, con su SENTIDO.
   *
   * No basta la glosa: el mismo texto aparece como cargo y como abono en el
   * mismo extracto —`TRASPASO ENTRE CAJAS DE AHORRO (MOVIL)` lo hace— y sin el
   * tipo las dos filas compartían veredicto, de modo que un ingreso quedaba
   * rotulado «Transferencia enviada». La deduplicación real la hace el propio
   * hook, por glosa y sentido.
   */
  const movimientos = useMemo(
    () =>
      asRows(asRecord(run.data?.result).transactions)
        .map((fila) => ({
          descripcion: String(fila.description ?? ''),
          movementType: String(fila.movementType ?? ''),
        }))
        .filter((movimiento) => movimiento.descripcion !== ''),
    [run.data?.result],
  );
  const glosas = useMemo(
    () => new Set(movimientos.map((movimiento) => claveMovimiento(movimiento))).size,
    [movimientos],
  );
  /*
   * El reparto por categoría se recalcula mientras la clasificación avanza: cada
   * veredicto que llega mueve una barra, que es la forma honesta de enseñar que
   * el trabajo está ocurriendo —y no una animación inventada sobre datos quietos—.
   */
  const resumen = useMemo(
    () => resumirCategorias(run.data?.result, categorias.veredictos),
    [run.data?.result, categorias.veredictos],
  );
  /*
   * Las cuentas del periodo NO dependen de haber clasificado: suman movimientos.
   * Por eso se calculan aparte y se enseñan siempre, mientras que el reparto por
   * categoría espera a que haya categorías que repartir.
   */
  const cuentas = useMemo(() => resumirExtracto(run.data?.result), [run.data?.result]);

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
              className="button button-primary"
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
            worker={WORKER}
            run={run.data}
            onCancel={() => cancel.mutate()}
            cancelling={cancel.isPending}
            onReset={reset}
            actions={
              finished ? (
                <StatementDownloads
                  result={run.data.result}
                  veredictos={categorias.veredictos}
                  clasificadas={categorias.total}
                  descargando={descargar.isPending}
                  onDescargarDelMotor={(format) => descargar.mutate(format)}
                />
              ) : null
            }
          />
        </Panel>
      ) : null}

      {run.data?.result ? (
        <Panel title="Movimientos">
          {/*
           * Clasificar es un paso APARTE de convertir, y por eso se pide aquí y
           * no se encadena solo: el motor no tiene ninguna ruta «extracto →
           * categorías», así que esto son N ejecuciones del worker semántico
           * lanzadas desde el navegador. Ofrecerlo con su coste a la vista es lo
           * honesto; dispararlo solo convertiría cada conversión en una tanda.
           */}
          {glosas > 0 ? (
            <StatementCategoriesBar
              glosas={glosas}
              corriendo={categorias.corriendo}
              hechas={categorias.hechas}
              total={categorias.total}
              demasiadas={categorias.demasiadas}
              maxGlosas={categorias.maxGlosas}
              onClasificar={() => void categorias.clasificar(movimientos)}
              onParar={categorias.parar}
            />
          ) : null}
          {/*
           * El resumen del periodo va ANTES de la tabla: es la pregunta que se
           * hace primero —cuánto entró, cuánto salió, qué quedó— y se responde
           * con todos los movimientos, clasificados o no.
           */}
          <StatementAnalytics resumen={cuentas} />
          <StatementResultView
            result={run.data.result}
            warnings={run.data.warnings}
            categorias={categorias.total > 0 ? categorias.veredictos : undefined}
          />
          {/*
           * El reparto va DEBAJO de la tabla y no encima: primero el dato —cada
           * movimiento con su categoría— y después el resumen, que es una
           * lectura de ese dato. Aparece sólo cuando hay algo clasificado; antes
           * de pulsar «Clasificar» sería un gráfico de una sola barra gris.
           */}
          {categorias.total > 0 ? <StatementCategoriesChart resumen={resumen} /> : null}
        </Panel>
      ) : null}
    </div>
  );
}
