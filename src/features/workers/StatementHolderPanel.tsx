import { HOLDER_VERDICT_LABEL, type StatementHolder } from './statement-review';

/**
 * De quién es la cuenta: el titular que se exige (el cliente que subió el extracto) frente al que se leyó en
 * la carátula, con el veredicto del motor (2026-10-16).
 *
 * Va en el caso y en la Consola porque es lo primero que mira quien revisa un «titular sin confirmar», y lo
 * que explica un rechazo por titular distinto. Sin titular exigido (la Consola) sólo informa lo leído.
 */
export function StatementHolderPanel({ holder }: { holder: StatementHolder | null | undefined }) {
  if (!holder || (!holder.expected && !holder.read)) return null;
  const veredicto = holder.verdict ? HOLDER_VERDICT_LABEL[holder.verdict] : null;
  const tono =
    holder.verdict === 'MATCH'
      ? 'ok'
      : holder.verdict === 'MISMATCH'
        ? 'mal'
        : holder.verdict === 'UNREADABLE'
          ? 'duda'
          : 'neutro';
  return (
    <section
      className="revision-caso-titular"
      data-testid="statement-holder"
      data-verdict={holder.verdict ?? ''}
    >
      <h4>Titular de la cuenta</h4>
      <dl className="revision-caso-hechos">
        <div>
          <dt>Cliente que lo subió</dt>
          <dd>{holder.expected ?? 'No se exigió'}</dd>
        </div>
        <div>
          <dt>Titular en el extracto</dt>
          <dd>{holder.read ?? 'No se pudo leer'}</dd>
        </div>
        {veredicto ? (
          <div>
            <dt>Comparación</dt>
            <dd className={`revision-caso-titular-${tono}`}>{veredicto}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
