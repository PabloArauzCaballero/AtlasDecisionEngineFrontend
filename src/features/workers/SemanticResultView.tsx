'use client';

import { StatusBadge } from '../../components/StatusBadge';
import { asRecord, asRows, type UnknownRecord } from '../../utils/records';

/**
 * Resultado de un análisis semántico.
 *
 * Se lee de forma defensiva (`asRecord`/`asRows`) y no con un tipo cerrado: el
 * resultado viene de un JSON que escribió el motor, posiblemente con una
 * versión anterior del worker. Un acceso directo a un campo que ya no existe
 * rompería la vista entera en vez de dejar un hueco.
 */
export function SemanticResultView({ result }: { result: unknown }) {
  const data = asRecord(result);
  const status = String(data.status ?? 'UNKNOWN');
  const matches = asRows(data.matches);
  const entities = asRows(data.entities);

  return (
    <div className="worker-result">
      <div className="worker-result-summary">
        <StatusBadge
          value={decisionTone(status)}
          labels={{ [decisionTone(status)]: DECISION_LABEL[status] ?? status }}
        />
        <p className="worker-result-explain">
          {DECISION_HELP[status] ?? 'Resultado del análisis.'}
        </p>
      </div>

      <dl className="worker-run-facts">
        <div>
          <dt>Nivel usado</dt>
          <dd>{String(data.tierUsed ?? '—') === 'DEEP' ? 'Profundo' : 'Rápido'}</dd>
        </div>
        <div>
          <dt>Modelo</dt>
          <dd>
            <code>{String(data.model ?? '—')}</code>
          </dd>
        </div>
        <div>
          <dt>Tiempo de análisis</dt>
          <dd>{Number(data.processingTimeMs ?? 0).toLocaleString('es-BO')} ms</dd>
        </div>
      </dl>

      {matches.length > 0 ? (
        <section>
          <h3 className="worker-section-title">Categorías</h3>
          <ul className="worker-match-list">
            {matches.map((match: UnknownRecord, index) => (
              <li key={String(match.categoryCode ?? index)} className="worker-match">
                <div className="worker-match-head">
                  <code>{String(match.categoryCode ?? '—')}</code>
                  <span className="worker-match-confidence">
                    {Math.round(Number(match.confidence ?? 0) * 100)}% de confianza
                  </span>
                  {match.contradicted ? (
                    <span className="worker-match-flag">Contradicha</span>
                  ) : null}
                </div>
                {match.rationale ? (
                  <p className="worker-match-rationale">{String(match.rationale)}</p>
                ) : null}
                {asRows(match.evidence).length > 0 ? (
                  <ul className="worker-evidence">
                    {asRows(match.evidence).map((piece, pieceIndex) => (
                      <li key={pieceIndex}>{String(piece)}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {entities.length > 0 ? (
        <section>
          <h3 className="worker-section-title">Entidades reconocidas</h3>
          <ul className="worker-entity-list">
            {entities.map((entity: UnknownRecord, index) => (
              <li key={index}>
                <code>{String(entity.type ?? '—')}</code> {String(entity.canonicalName ?? '')}
                <small> · leído de «{String(entity.sourceText ?? '')}»</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const DECISION_LABEL: Record<string, string> = {
  MATCH: 'Categoría única',
  MULTI_MATCH: 'Varias categorías',
  UNKNOWN: 'Sin determinar',
  AMBIGUOUS: 'Ambiguo',
  CONTRADICTED: 'Contradicho',
};

/**
 * Qué significa cada veredicto, en una frase.
 *
 * `AMBIGUOUS` y `UNKNOWN` son los que más falta hacen: sin explicación se leen
 * como un fallo del sistema, cuando son justamente el sistema negándose a
 * elegir sin evidencia suficiente.
 */
const DECISION_HELP: Record<string, string> = {
  MATCH: 'El texto encaja sin ambigüedad en una sola categoría.',
  MULTI_MATCH: 'El texto sostiene varias categorías a la vez, y todas con evidencia.',
  UNKNOWN: 'No hay evidencia suficiente para ninguna categoría. No es un error: es una abstención.',
  AMBIGUOUS:
    'Dos o más categorías quedaron demasiado próximas para elegir entre ellas. Prefiere no decidir a decidir mal.',
  CONTRADICTED: 'El texto contiene algo que contradice la categoría que más se le parecía.',
};

function decisionTone(status: string): string {
  if (status === 'MATCH') return 'PASSED';
  if (status === 'MULTI_MATCH' || status === 'AMBIGUOUS') return 'WARNING';
  if (status === 'CONTRADICTED') return 'FAILED';
  return 'INACTIVE';
}
