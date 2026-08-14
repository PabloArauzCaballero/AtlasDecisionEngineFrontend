'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Panel } from '../components/Panel';
import { AudioResultView } from '../features/workers/AudioResultView';
import { missingVariables, templateVariables } from '../features/workers/audio-types';
import { WorkerHeaderFacts } from '../features/workers/WorkerHeaderFacts';
import { WorkerInputChoice } from '../features/workers/WorkerInputChoice';
import { WorkerRunTracker } from '../features/workers/WorkerRunTracker';
import { useWorkerRun } from '../features/workers/useWorkerRun';
import {
  cancelRun,
  createAudioTtsRun,
  fetchAudioTemplates,
  fetchFixtures,
  fetchWorkerCatalog,
} from '../features/workers/workers.api';
import type { WorkerDescriptor } from '../features/workers/worker-types';
import { useUnsavedWork } from '../navigation/UnsavedWorkProvider';
import { useNotifications } from '../notifications/useNotifications';

const WORKER = 'audio-tts' as const;

/**
 * Consola de locución: elegir qué se dice y oírlo.
 *
 * La diferencia con las otras tres consolas es que aquí **enviar puede costar
 * dinero**. Por eso la pantalla dice antes de pulsar de dónde saldrá el audio
 * —la caché o el proveedor— y por eso no hay un cuadro de texto libre: lo que
 * se puede decir con la voz de la organización lo fija su catálogo de
 * plantillas, no quien tenga esta pestaña abierta.
 *
 * No pinta cabecera de página: vive dentro de la pestaña «Consola» de
 * `WorkersPage`, que ya dice de qué worker se trata.
 */
export function AudioTtsWorkerConsole() {
  const { notify } = useNotifications();
  const [mode, setMode] = useState<'fixture' | 'own'>('fixture');
  const [fixtureCode, setFixtureCode] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
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

  const templates = useQuery({
    queryKey: ['audio-templates'],
    queryFn: ({ signal }) => fetchAudioTemplates(signal),
  });
  const template = templates.data?.find((item) => item.code === templateCode);
  const variables = templateVariables(template);
  const pending = missingVariables(template, values);

  const run = useWorkerRun(WORKER, requestId);

  const submit = useMutation({
    mutationFn: () =>
      createAudioTtsRun(
        mode === 'fixture'
          ? { fixtureCode }
          : { templateCode, variables: onlyDeclared(variables, values) },
      ),
    onSuccess: (created) => {
      setRequestId(created.requestId);
      notify({
        tone: 'success',
        title: 'Locución encolada',
        description: 'El resultado aparecerá abajo en cuanto un worker la resuelva.',
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
        title: 'Locución cancelada',
        description: 'No llegó a procesarse.',
      }),
  });

  /*
   * Qué se perdería al salir: una plantilla elegida con sus variables escritas
   * y todavía sin enviar. No cuenta el radio marcado por omisión —eso no es
   * trabajo, y avisar por ello enseñaría a descartar el aviso sin leerlo—.
   */
  useUnsavedWork(
    requestId === null && mode === 'own' && templateCode !== '',
    'Una locución preparada en la consola, sin enviar.',
  );

  const canSubmit =
    descriptor?.available === true &&
    (mode === 'fixture' ? fixtureCode !== '' : templateCode !== '' && pending.length === 0);

  function reset() {
    setRequestId(null);
    setFixtureCode('');
    setTemplateCode('');
    setValues({});
  }

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
          ownLabel="Elegir una plantilla"
          disabled={requestId !== null}
        >
          <label className="field">
            <span className="field-label">Plantilla</span>
            <select
              value={templateCode}
              onChange={(event) => {
                setTemplateCode(event.target.value);
                // Las variables de la anterior no valen para la nueva: dejarlas
                // enviaría valores que esta plantilla no declara.
                setValues({});
              }}
              disabled={requestId !== null}
              aria-describedby="audio-template-help"
            >
              <option value="">Elige una plantilla…</option>
              {(templates.data ?? []).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code}
                </option>
              ))}
            </select>
            <small id="audio-template-help" className="field-help">
              El catálogo decide qué se puede decir con esta voz. No hay texto libre.
            </small>
          </label>

          {template ? (
            <div className="worker-audio-template">
              <span className="field-label">Cómo quedará</span>
              <p className="worker-audio-preview">{preview(template.templateText, values)}</p>
            </div>
          ) : null}

          {variables.map((name) => (
            <label className="field" key={name}>
              <span className="field-label">{name}</span>
              <input
                type="text"
                value={values[name] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [name]: event.target.value }))
                }
                disabled={requestId !== null}
                maxLength={80}
              />
            </label>
          ))}

          {pending.length > 0 ? (
            <p className="field-help is-error">
              Falta rellenar: {pending.join(', ')}. El motor las exige todas.
            </p>
          ) : null}
        </WorkerInputChoice>

        {requestId === null ? (
          <div className="worker-run-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={!canSubmit || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Enviando…' : 'Locutar'}
            </button>
            {descriptor && !descriptor.available ? (
              <p className="field-help">
                Este worker está apagado en el entorno actual. Puedes consultar locuciones
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
          />
        </Panel>
      ) : null}

      {requestId && run.data?.result ? (
        <Panel title="Resultado">
          <AudioResultView result={run.data.result} requestId={requestId} />
        </Panel>
      ) : null}
    </div>
  );
}

/**
 * Sólo las variables que la plantilla declara.
 *
 * El motor rechaza la solicitud con una variable de más (`resolve-audio.schema`
 * es estricto), y quien cambia de plantilla deja escritas las de la anterior en
 * el estado. Filtrar aquí evita un rechazo que quien lo recibe no sabría
 * explicar.
 */
function onlyDeclared(declared: string[], values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    declared.map((name) => [name, (values[name] ?? '').trim()]).filter(([, value]) => value !== ''),
  );
}

/**
 * El texto tal como sonará, con lo escrito ya puesto dentro.
 *
 * Sustituye lo que hay y deja visible lo que falta entre llaves: enseñar la
 * plantilla cruda obliga a componer la frase mentalmente, y enseñarla con los
 * huecos en blanco esconde que faltan.
 */
function preview(templateText: string, values: Record<string, string>): string {
  return templateText.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/gu, (match, name: string) => {
    const value = (values[name] ?? '').trim();
    return value === '' ? match : value;
  });
}
