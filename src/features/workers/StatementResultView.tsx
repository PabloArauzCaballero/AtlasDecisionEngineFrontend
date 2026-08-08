'use client';

import { asRecord, asRows, asStrings, type UnknownRecord } from '../../utils/records';
import { claveGlosa, type VeredictoCategoria } from './useStatementCategories';

/**
 * Resultado de una conversión de extracto.
 *
 * Lectura defensiva: el JSON lo escribió el motor y puede venir de una versión
 * anterior del worker. Un campo que falte deja un hueco, no rompe la tabla.
 */
export function StatementResultView({
  result,
  warnings,
  categorias,
}: {
  result: unknown;
  warnings?: unknown;
  /** Veredictos del semántico por glosa normalizada. Sin ellos, no hay columna. */
  categorias?: Record<string, VeredictoCategoria>;
}) {
  const data = asRecord(result);
  const institution = asRecord(data.institution);
  const account = asRecord(data.account);
  const period = asRecord(data.period);
  const balances = asRecord(data.balances);
  const quality = asRecord(data.quality);
  const transactions = asRows(data.transactions);
  const warningList = asStrings(warnings);

  return (
    <div className="worker-result">
      <dl className="worker-run-facts">
        <div>
          <dt>Institución</dt>
          <dd>{String(institution.name ?? 'No identificada')}</dd>
        </div>
        <div>
          <dt>Cuenta</dt>
          <dd>
            <code>{String(account.accountNumberMasked ?? '—')}</code>
          </dd>
        </div>
        <div>
          <dt>Periodo</dt>
          <dd>
            {String(period.from ?? '—')} — {String(period.to ?? '—')}
          </dd>
        </div>
        <div>
          <dt>Saldos</dt>
          <dd>
            {formatAmount(balances.opening)} → {formatAmount(balances.closing)}
          </dd>
        </div>
        <div>
          <dt>Confianza</dt>
          <dd>
            {Math.round(Number(quality.overallConfidence ?? 0) * 100)}% ·{' '}
            {String(quality.band ?? '—')}
          </dd>
        </div>
        <div>
          <dt>Movimientos</dt>
          <dd>{transactions.length}</dd>
        </div>
      </dl>

      {warningList.length > 0 ? (
        <div className="worker-warnings">
          <h3 className="worker-section-title">Advertencias</h3>
          <p className="field-help">
            El resultado es utilizable, pero estos puntos quedaron sin resolver del todo. Conviene
            contrastarlos con el documento original antes de darlo por bueno.
          </p>
          <ul>
            {warningList.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
       * La tabla desborda en horizontal dentro de su propio contenedor: en un
       * teléfono, dejar que empuje el ancho del documento haría que TODA la
       * página se desplazase de lado, no sólo la tabla.
       */}
      <div className="worker-table-scroll">
        <table className="data-table">
          <caption className="sr-only">
            Movimientos leídos del extracto, con fecha, glosa, importe y saldo.
          </caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Descripción</th>
              <th scope="col">Tipo</th>
              {categorias ? <th scope="col">Categoría</th> : null}
              <th scope="col" className="is-numeric">
                Importe
              </th>
              <th scope="col" className="is-numeric">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((row: UnknownRecord, index) => (
              <tr key={String(row.id ?? index)}>
                <td>{String(row.transactionDate ?? '—')}</td>
                <td>{String(row.description ?? '')}</td>
                <td>{movementLabel(String(row.movementType ?? ''))}</td>
                {categorias ? (
                  <td>
                    <CategoriaCelda
                      veredicto={categorias[claveGlosa(String(row.description ?? ''))]}
                    />
                  </td>
                ) : null}
                <td className="is-numeric">{formatAmount(row.amount)}</td>
                <td className="is-numeric">{formatAmount(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * La categoría de un movimiento, o por qué no la hay.
 *
 * Un veredicto `AMBIGUOUS` o `UNKNOWN` **no se asciende** a la primera
 * candidata: el motor dice que no lo tiene claro, y presentar una categoría
 * dudosa como firme es peor que dejar el hueco: quien mira la tabla no tiene
 * forma de saber cuáles se decidieron y cuáles se adivinaron.
 */
function CategoriaCelda({ veredicto }: { veredicto?: VeredictoCategoria }) {
  if (!veredicto || veredicto.fase === 'esperando') return <span className="worker-faint">—</span>;
  if (veredicto.fase === 'en-curso') return <span className="worker-faint">Clasificando…</span>;
  if (veredicto.fase === 'fallido') {
    return (
      <span className="worker-categoria-error" title={veredicto.error}>
        No se pudo
      </span>
    );
  }
  if (!veredicto.categoria || veredicto.estado === 'UNKNOWN') {
    return <span className="worker-faint">Sin determinar</span>;
  }

  const ruta = veredicto.ruta ?? [];
  return (
    <span className="worker-categoria">
      <code>{veredicto.categoria}</code>
      {ruta.length > 1 ? <small>{ruta.join(' › ')}</small> : null}
      {veredicto.estado !== 'MATCH' ? (
        <small className="worker-categoria-duda">
          {veredicto.estado === 'AMBIGUOUS' ? 'Ambiguo' : 'Varias candidatas'}
        </small>
      ) : null}
    </span>
  );
}

function movementLabel(type: string): string {
  if (type === 'DEBIT') return 'Débito';
  if (type === 'CREDIT') return 'Crédito';
  return 'Sin determinar';
}

/**
 * Importe con dos decimales, o un guion.
 *
 * `null` significa «el documento no lo publicaba o no se pudo leer», y es
 * distinto de cero. Pintar un 0 donde no hay dato haría cuadrar sumas que en
 * realidad no cuadran.
 */
function formatAmount(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
