'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { asRecord, display, type UnknownRecord } from '../../utils/records';
import { CASE_FAILURE_TEXT } from './qa-run-archive';
import { useQaPropertyLabels } from './qa-properties';

interface Props {
  counterexamples: UnknownRecord[];
}

const KIND_LABEL: Readonly<Record<string, string>> = {
  VALID: 'válido',
  BOUNDARY: 'en el límite',
  INVALID: 'inválido',
};

/** «12/INVALID/edad: justo por encima del máximo» → qué clase de caso era y qué se tocó. */
function describePath(path: string): string {
  const [index, kind, ...rest] = path.split('/');
  if (!kind) return path;
  const detail = rest.join('/');
  return `caso ${Number(index) + 1}, ${KIND_LABEL[kind] ?? kind}${detail ? ` (${detail})` : ''}`;
}

/** Una entrada como tabla variable → valor, con el JSON a un clic para copiarlo. */
function InputTable({ input }: { input: unknown }) {
  const rows = Object.entries(asRecord(input));
  return (
    <>
      {rows.length ? (
        <table className="qa-input-table">
          <thead>
            <tr>
              <th scope="col">Variable</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, value]) => (
              <tr key={key}>
                <td>
                  <code>{key}</code>
                </td>
                <td>{typeof value === 'string' ? value : JSON.stringify(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="field-hint">Sin variables: el fallo aparece con la entrada vacía.</p>
      )}
      <details>
        <summary>Ver los datos sin formato, para copiarlos</summary>
        <pre className="code-block">{JSON.stringify(input, null, 2)}</pre>
      </details>
    </>
  );
}

/**
 * Contraejemplos mínimos de una corrida (§10.5).
 *
 * Lo que se muestra es el caso REDUCIDO, no la entrada aleatoria original: un
 * contraejemplo de veinte campos no lo depura nadie. La entrada completa queda a un
 * clic por si hace falta.
 */
export function QaCounterexampleList({ counterexamples }: Props) {
  if (!counterexamples.length) {
    return (
      <p className="constraint-result constraint-valid">
        <CheckCircle2 size={14} aria-hidden /> Ningún caso incumplió las comprobaciones.
      </p>
    );
  }
  return (
    <ul className="qa-counterexamples">
      {counterexamples.map((entry) => (
        <QaCounterexampleRow key={display(entry, 'id')} entry={entry} />
      ))}
    </ul>
  );
}

function replayText(result: UnknownRecord): string {
  const kind = KIND_LABEL[String(result.kind ?? '')] ?? 'válido';
  const times = Number(result.executions ?? 1);
  const how = `reejecutado como caso ${kind}${times > 1 ? `, ${times} veces` : ''}`;
  if (result.reproduced) return ` El fallo se reproduce con el caso reducido (${how}).`;
  if (result.property === 'DETERMINISM') {
    return ` Esta vez no se reprodujo (${how}): las ${times} ejecuciones dieron el mismo resultado. Un fallo intermitente puede no repetirse en cada intento.`;
  }
  return ` Esta vez no se reprodujo (${how}): con la versión de la corrida, esta entrada ya cumple la comprobación.`;
}

function QaCounterexampleRow({ entry }: { entry: UnknownRecord }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const property = display(entry, 'property');
  const failureCode = display(entry, 'failureCode');
  // Las etiquetas las publica el MOTOR, con respaldo local.
  const etiquetas = useQaPropertyLabels();

  const replay = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/qa-lab/counterexamples/${encodeURIComponent(display(entry, 'id'))}/replay`,
        { method: 'POST', body: {} },
      ),
  });
  const result = asRecord(replay.data);

  return (
    <li className="qa-counterexample">
      <div className="qa-counterexample-head">
        <span className="qa-property">{etiquetas[property] ?? property}</span>
      </div>
      <p>
        {CASE_FAILURE_TEXT[failureCode] ?? display(entry, 'failureMessage')}{' '}
        <small className="field-hint">
          ({display(entry, 'replayPath') ? describePath(display(entry, 'replayPath')) : 'caso'})
        </small>
      </p>

      <div className="qa-counterexample-body">
        <div>
          <h5>Caso reducido (lo mínimo que sigue fallando)</h5>
          <InputTable input={entry.shrunkInput} />
        </div>
        {showOriginal ? (
          <div>
            <h5>Caso original completo</h5>
            <InputTable input={entry.originalInput} />
          </div>
        ) : null}
      </div>

      <div className="panel-actions">
        <button type="button" className="button" onClick={() => setShowOriginal((open) => !open)}>
          {showOriginal ? 'Ocultar el caso original' : 'Ver el caso original'}
        </button>
        <button
          type="button"
          className="button"
          disabled={replay.isPending}
          onClick={() => replay.mutate()}
        >
          <RotateCcw size={14} aria-hidden />{' '}
          {replay.isPending ? 'Reejecutando…' : 'Volver a ejecutar este caso'}
        </button>
        <details>
          <summary>Detalle técnico</summary>
          <small className="field-hint">
            <code>{failureCode}</code> · {display(entry, 'failureMessage')} · semilla{' '}
            <code>{display(entry, 'replaySeed')}</code>
          </small>
        </details>
      </div>

      {replay.isError ? <Alert tone="error">{errorMessage(replay.error)}</Alert> : null}
      {replay.isSuccess ? (
        <p
          className={`constraint-result ${result.reproduced ? 'constraint-invalid' : 'constraint-valid'}`}
        >
          {result.reproduced ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
          {replayText(result)}
        </p>
      ) : null}
    </li>
  );
}
