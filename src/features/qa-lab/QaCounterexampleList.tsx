'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { apiRequest } from '../../api/http-client';
import { asRecord, display, type UnknownRecord } from '../../utils/records';

interface Props {
  counterexamples: UnknownRecord[];
}

const PROPERTY_LABELS: Record<string, string> = {
  INPUT_CONTRACT_ENFORCED: 'El contrato de entrada se impone',
  OUTPUT_CONTRACT_RESPECTED: 'La salida cumple el contrato',
  OUTPUT_TYPES_MATCH_CONTRACT: 'Los tipos de salida coinciden',
  NO_INTERMEDIATE_LEAK: 'Ninguna intermedia se filtra',
  NO_SENSITIVE_LEAK: 'Ningún dato sensible se filtra',
  DETERMINISM: 'La misma entrada da el mismo resultado',
};

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
        <CheckCircle2 size={14} aria-hidden /> Ninguna propiedad falló en esta corrida.
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

function QaCounterexampleRow({ entry }: { entry: UnknownRecord }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const property = display(entry, 'property');

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
        <span className="qa-property">{PROPERTY_LABELS[property] ?? property}</span>
        <code>{display(entry, 'failureCode')}</code>
      </div>
      <p>{display(entry, 'failureMessage')}</p>

      <div className="qa-counterexample-body">
        <div>
          <h5>Contraejemplo mínimo</h5>
          <pre className="code-block">{JSON.stringify(entry.shrunkInput, null, 2)}</pre>
        </div>
        {showOriginal ? (
          <div>
            <h5>Entrada original completa</h5>
            <pre className="code-block">{JSON.stringify(entry.originalInput, null, 2)}</pre>
          </div>
        ) : null}
      </div>

      <div className="panel-actions">
        <button type="button" className="button" onClick={() => setShowOriginal((open) => !open)}>
          {showOriginal ? 'Ocultar entrada original' : 'Ver entrada original'}
        </button>
        <button
          type="button"
          className="button"
          disabled={replay.isPending}
          onClick={() => replay.mutate()}
        >
          <RotateCcw size={14} aria-hidden />{' '}
          {replay.isPending ? 'Reproduciendo…' : 'Volver a ejecutar'}
        </button>
        <small className="field-hint">
          semilla <code>{display(entry, 'replaySeed')}</code>
          {display(entry, 'replayPath') ? ` · caso ${display(entry, 'replayPath')}` : ''}
        </small>
      </div>

      {replay.isSuccess ? (
        <p
          className={`constraint-result ${result.reproduced ? 'constraint-invalid' : 'constraint-valid'}`}
        >
          {result.reproduced ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
          {result.reproduced
            ? ' El fallo se reproduce con el contraejemplo mínimo.'
            : ' Ya no se reproduce: la versión actual corrige este caso.'}
        </p>
      ) : null}
    </li>
  );
}
