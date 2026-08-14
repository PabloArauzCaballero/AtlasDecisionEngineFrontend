'use client';

import { useEffect, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { useNotifications } from '../../notifications/useNotifications';
import { asRecord } from '../../utils/records';
import {
  costLabel,
  formatBytes,
  OUTCOME_HELP,
  OUTCOME_LABEL,
  outcomeTone,
  segmentsLabel,
  voiceSummary,
  type AudioOutcome,
  type AudioRunResult,
} from './audio-types';
import { downloadAudio } from './workers.api';

/**
 * Resultado de una locución: qué se sirvió, con qué voz, y poder oírlo.
 *
 * Se lee de forma defensiva (`asRecord`) y no con un tipo cerrado, igual que el
 * resto de vistas de worker: el resultado viene de un JSON que escribió el
 * motor, quizá con una versión anterior. Un acceso directo a un campo que ya no
 * existe rompería la vista entera en vez de dejar un hueco.
 *
 * Lo que NO enseña es el texto locutado. Su única copia vive cifrada en la
 * caché del motor —lleva dentro las variables, que pueden ser el nombre de una
 * persona— y el motor no lo publica. Quien pidió la locución ya sabe qué pidió:
 * las variables están arriba, en el formulario.
 */
export function AudioResultView({ result, requestId }: { result: unknown; requestId: string }) {
  const data = asRecord(result) as unknown as AudioRunResult;
  const outcome = normalizeOutcome(data.outcome);

  return (
    <div className="worker-result">
      <div className="worker-result-summary">
        <StatusBadge
          value={outcomeTone(outcome)}
          labels={{ [outcomeTone(outcome)]: OUTCOME_LABEL[outcome] }}
        />
        <p className="worker-result-explain">{OUTCOME_HELP[outcome]}</p>
      </div>

      {data.reason ? <p className="worker-audio-reason">{data.reason}</p> : null}

      {data.audioAvailable ? (
        <AudioPlayer requestId={requestId} />
      ) : (
        <p className="field-help">
          No hay nada que reproducir en esta ejecución. Quien la pidió debe continuar sin audio.
        </p>
      )}

      <dl className="worker-run-facts">
        <div>
          <dt>Plantilla</dt>
          <dd>
            <code>{data.templateCode ?? '—'}</code>
            {data.templateVersion === null ? '' : ` v${data.templateVersion}`}
          </dd>
        </div>
        <div>
          <dt>Voz</dt>
          <dd>{voiceSummary(data) ?? '—'}</dd>
        </div>
        <div>
          <dt>Idioma</dt>
          <dd>{data.language ?? '—'}</dd>
        </div>
        <div>
          <dt>Proveedor</dt>
          <dd>
            <code>{data.provider ?? '—'}</code>
          </dd>
        </div>
        <div>
          <dt>Formato</dt>
          <dd>
            {data.outputFormat ?? '—'}
            {data.sampleRate === null ? '' : ` · ${data.sampleRate} Hz`}
          </dd>
        </div>
        <div>
          {/*
           * Cuánto costó: la única pregunta que un worker de pago plantea de
           * verdad. Son TRES casos y no dos. Derivarlo sólo de `cacheHit` decía
           * «Se generó en esta ejecución» sobre una locución que había servido
           * el respaldo justo porque no se pudo generar nada — se vio en la
           * captura `06-resultado-respaldo.png`, afirmando un gasto que no
           * ocurrió.
           */}
          <dt>Coste</dt>
          <dd>{costLabel(data)}</dd>
        </div>
        {segmentsLabel(data) ? (
          <div>
            {/*
             * Un audio cosido por tramos no entona como una toma continua, y el
             * ahorro que lo justifica merece verse: los tramos de caché ya
             * estaban pagados, esta ejecución sólo pagó los generados.
             */}
            <dt>Composición</dt>
            <dd>{segmentsLabel(data)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Tamaño</dt>
          <dd>{formatBytes(data.bytes) ?? '—'}</dd>
        </div>
        <div>
          {/*
           * La huella se enseña entera y en monoespaciada: sirve para comprobar
           * que dos locuciones son el MISMO audio, y recortarla la volvería
           * decorativa.
           */}
          <dt>Huella del audio</dt>
          <dd>
            <code className="worker-audio-checksum">{data.checksumSha256 ?? '—'}</code>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Reproductor con el audio traído por la puerta autenticada.
 *
 * No se apunta el `<audio>` al motor: cargar un medio es una petición del
 * navegador y ahí no viaja el `Authorization`, así que el reproductor recibiría
 * un 401 y se quedaría mudo sin decir por qué. Se pide con la credencial puesta
 * y se reproduce un blob local.
 *
 * El blob se revoca al desmontar. Sin eso, cada locución escuchada deja su copia
 * del audio en memoria hasta recargar la página.
 */
function AudioPlayer({ requestId }: { requestId: string }) {
  const { notify } = useNotifications();
  const [source, setSource] = useState<{ url: string; fileName: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;

    void downloadAudio(requestId)
      .then((file) => {
        if (cancelled) return;
        url = URL.createObjectURL(file.blob);
        setSource({ url, fileName: file.fileName });
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        notify({
          tone: 'error',
          title: 'No se pudo traer el audio',
          description: 'La locución terminó, pero su audio no está disponible ahora mismo.',
        });
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [requestId, notify]);

  if (failed) {
    return <p className="field-help is-error">El audio de esta locución no está disponible.</p>;
  }
  if (!source) {
    return <p className="field-help">Trayendo el audio…</p>;
  }

  return (
    <div className="worker-audio-player">
      {/* `controls` y nada más: no se autorreproduce. Un sonido que empieza solo
          en una pestaña de trabajo es exactamente lo que nadie quiere. */}
      <audio controls src={source.url} aria-label="Audio de la locución">
        Tu navegador no puede reproducir este audio.
      </audio>
      <a className="button button-ghost" href={source.url} download={source.fileName}>
        Descargar
      </a>
    </div>
  );
}

/** Un desenlace que este portal todavía no conoce se lee como «sin audio». */
function normalizeOutcome(value: unknown): AudioOutcome {
  const text = String(value ?? '');
  if (text === 'READY' || text === 'QUEUED' || text === 'FALLBACK') return text;
  return 'UNAVAILABLE';
}
