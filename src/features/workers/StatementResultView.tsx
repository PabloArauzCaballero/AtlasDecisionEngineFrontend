'use client';

import { asRecord, asRows, asStrings, type UnknownRecord } from '../../utils/records';
import { formatNumber } from '../../config/locale';
import { claveMovimiento, type VeredictoCategoria } from './useStatementCategories';
import { useResizableColumns, type ColumnasAjustables } from './useResizableColumns';

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

/**
 * Cabecera con tirador de ancho.
 *
 * El tirador es un `<button>` y no un `<div>`: además de arrastrarse se enfoca
 * con el tabulador y responde a las flechas, que es la única forma de ajustar
 * una columna sin ratón. Su nombre accesible dice qué columna mueve, porque
 * media docena de «Redimensionar» idénticos no orientan a nadie.
 */
function Cabecera({
  columna,
  columnas,
  numerica = false,
  children,
}: {
  columna: string;
  columnas: ColumnasAjustables;
  numerica?: boolean;
  children: React.ReactNode;
}) {
  const ancho = columnas.anchoDe(columna);
  return (
    <th
      scope="col"
      className={numerica ? 'is-numeric' : undefined}
      style={ancho === undefined ? undefined : { inlineSize: `${ancho}px` }}
    >
      <span className="th-rotulo">{children}</span>
      <button
        type="button"
        className="th-tirador"
        aria-label={`Ajustar el ancho de la columna ${String(children)}`}
        onPointerDown={columnas.empezar(columna)}
        onKeyDown={columnas.conTeclado(columna)}
      />
    </th>
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
  /*
   * Una barra, no la palabra «Clasificando…». La fila no tiene avance que
   * contar —o está pedida o está resuelta—, así que la barra es indeterminada:
   * dice «esto se está haciendo» sin fingir un porcentaje. El texto va en
   * `aria-label` porque quien no ve la barra necesita leerlo, y el `title`
   * lo devuelve al pasar el ratón.
   */
  if (veredicto.fase === 'en-curso') {
    return (
      <span
        className="worker-categoria-cargando"
        role="progressbar"
        aria-label="Clasificando esta glosa"
        title="Clasificando…"
      />
    );
  }
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
  /*
   * El detalle completo, sin recortes: código, ruta ENTERA de la raíz a la hoja
   * y confianza.
   *
   * La ruta se pintaba sólo con `ruta.length > 1` y la celda la truncaba, así
   * que una hoja de primer nivel —«Ingresos › Depósito en efectivo»— se quedaba
   * en el código a secas y las profundas salían cortadas a media rama. Leer el
   * código no basta: `GASTOS.COMPRAS.QR` dice dónde cuelga, pero no que su rama
   * se llama «Compras» ni cuánta confianza sostuvo la decisión, que es lo que
   * hace falta para saber si conviene revisarla.
   */
  return (
    <span className="worker-categoria">
      <code>{veredicto.categoria}</code>
      {ruta.length > 0 ? <small className="worker-categoria-ruta">{ruta.join(' › ')}</small> : null}
      <small className="worker-categoria-confianza">
        {veredicto.confianza === undefined
          ? 'sin confianza declarada'
          : `confianza ${(veredicto.confianza * 100).toFixed(0)} %`}
        {veredicto.estado !== 'MATCH' ? (
          <span className="worker-categoria-duda">
            {veredicto.estado === 'AMBIGUOUS' ? 'Ambiguo' : 'Varias candidatas'}
          </span>
        ) : null}
      </small>
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
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
