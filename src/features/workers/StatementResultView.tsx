'use client';

import { asRecord, asRows, asStrings, type UnknownRecord } from '../../utils/records';
import { StatementAffordabilityPanel } from './StatementAffordabilityPanel';
import { StatementAuthenticityNote } from './StatementAuthenticityNote';
import { Cabecera, CategoriaCelda, formatAmount, movementLabel } from './StatementResultCells';
import { claveMovimiento, type VeredictoCategoria } from './useStatementCategories';
import { useResizableColumns } from './useResizableColumns';
import { WorkerNotes } from './WorkerNotes';

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
  const columnas = useResizableColumns('extracto-movimientos');

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

      {/*
        La autenticidad va ANTES de los movimientos y no al final, y no es
        cosmética: los mismos importes pesan distinto según con qué garantía
        llegaron. Un documento aceptado con indicios se lee de otra forma que
        uno limpio, y quien revise tiene que saberlo antes de mirar la tabla.
      */}
      <StatementAuthenticityNote result={result} />

      <StatementAffordabilityPanel result={result} />

      {/*
       * Los avisos del motor llegan ya redactados —los escribe el analizador del
       * extracto—, así que van como texto y sin código. Es la diferencia con la
       * consola de identidad, donde lo que llega son códigos del contrato.
       */}
      <WorkerNotes
        notas={warningList.map((texto) => ({ texto }))}
        ayuda="El resultado es utilizable, pero estos puntos quedaron sin resolver del todo. Conviene contrastarlos con el documento original antes de darlo por bueno."
      />

      {/*
       * La tabla desborda en horizontal dentro de su propio contenedor: en un
       * teléfono, dejar que empuje el ancho del documento haría que TODA la
       * página se desplazase de lado, no sólo la tabla.
       */}
      {columnas.ajustada ? (
        <p className="worker-table-ajuste">
          Anchos de columna ajustados a mano.{' '}
          <button type="button" className="link-button" onClick={columnas.restablecer}>
            Restablecer
          </button>
        </p>
      ) : null}

      {/*
       * `table-layout: fixed` sólo cuando hay algún ancho puesto a mano: con el
       * automático el navegador reparte según el contenido, que es mejor punto
       * de partida que cualquier número que se escriba aquí. En cuanto alguien
       * arrastra, el reparto pasa a ser suyo y el automático dejaría de
       * respetarlo.
       */}
      <div className="worker-table-scroll">
        <table className={`data-table${columnas.ajustada ? ' es-ajustada' : ''}`}>
          <caption className="sr-only">
            Movimientos leídos del extracto, con fecha, glosa, importe y saldo. El ancho de cada
            columna se ajusta arrastrando el borde derecho de su cabecera.
          </caption>
          <thead>
            <tr>
              <Cabecera columna="fecha" columnas={columnas}>
                Fecha
              </Cabecera>
              <Cabecera columna="descripcion" columnas={columnas}>
                Descripción
              </Cabecera>
              <Cabecera columna="tipo" columnas={columnas}>
                Tipo
              </Cabecera>
              {categorias ? (
                <Cabecera columna="categoria" columnas={columnas}>
                  Categoría
                </Cabecera>
              ) : null}
              <Cabecera columna="importe" columnas={columnas} numerica>
                Importe
              </Cabecera>
              <Cabecera columna="saldo" columnas={columnas} numerica>
                Saldo
              </Cabecera>
            </tr>
          </thead>
          <tbody>
            {transactions.map((row: UnknownRecord, index) => (
              <tr key={String(row.id ?? index)}>
                <td>{String(row.transactionDate ?? '—')}</td>
                <td>{String(row.description ?? '')}</td>
                <td>{movementLabel(String(row.movementType ?? ''))}</td>
                {categorias ? (
                  <td className="worker-categoria-celda">
                    <CategoriaCelda
                      /*
                       * Por glosa Y sentido: el mismo texto como cargo y como
                       * abono son dos veredictos distintos, y buscar sólo por
                       * la glosa devolvía el de la otra dirección.
                       */
                      veredicto={
                        categorias[
                          claveMovimiento({
                            descripcion: String(row.description ?? ''),
                            movementType: String(row.movementType ?? ''),
                          })
                        ]
                      }
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
