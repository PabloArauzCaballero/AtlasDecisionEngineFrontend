'use client';

import { AlertTriangle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { asRecord, asRows, type UnknownRecord } from '../../utils/records';

/**
 * La capacidad de pago que el motor derivó del extracto.
 *
 * ## Por qué esta pantalla enseña el CAMINO y no sólo la cifra
 *
 * Porque quien la mira tiene que poder discrepar. Un panel que dijera «capacidad
 * de pago: Bs 1.240» convierte al analista en alguien que firma lo que decidió
 * una máquina: no puede saber si esa cifra salió de un ingreso bien reconocido o
 * de haber contado como sueldo un traspaso entre cuentas del propio titular. Lo
 * que hay aquí es la cadena entera —qué entró, qué se descartó y por qué, qué se
 * restó, qué tope mordió— de modo que la cifra final sea comprobable renglón a
 * renglón contra el extracto que está al lado.
 *
 * ## Y por qué la serie mensual va primero
 *
 * Porque es la evidencia de que hay tres meses, que es la condición sin la cual
 * lo demás no significa nada. Un ingreso mediano de 7.800 sobre un solo mes y
 * sobre tres son la misma cifra y dos afirmaciones muy distintas.
 *
 * Lectura defensiva: el JSON lo escribió el motor y puede venir de una versión
 * anterior del worker. Un campo que falte deja un hueco, no rompe el panel.
 */

const BANDAS: Record<string, { rotulo: string; tono: string; detalle: string }> = {
  SOLIDA: {
    rotulo: 'Sólida',
    tono: 'ok',
    detalle: 'Ingreso estable con margen holgado sobre lo ya comprometido.',
  },
  ADECUADA: {
    rotulo: 'Adecuada',
    tono: 'info',
    detalle: 'Hay margen y conviene mirar los motivos antes de estirarlo.',
  },
  AJUSTADA: {
    rotulo: 'Ajustada',
    tono: 'warn',
    detalle: 'Queda poco margen: una cuota nueva lo consume casi entero.',
  },
  INSUFICIENTE: {
    rotulo: 'Insuficiente',
    tono: 'bad',
    detalle: 'No hay margen que comprometer con la evidencia de este extracto.',
  },
};

/** Qué limitó la cuota máxima. Es la pregunta que sigue siempre a la cifra. */
const TOPES: Record<string, string> = {
  DISPONIBLE: 'Lo que sobra tras el gasto comprometido, con su margen de seguridad',
  PTI: 'El tope de cuota sobre ingreso de la política (15 %)',
  DSTI: 'El tope de deuda total sobre ingreso de la política (35 %), contando lo que ya paga',
  SIN_MARGEN: 'No quedó margen: el gasto comprometido se lleva el ingreso',
};

const SEVERIDAD_ICONO: Record<string, typeof Info> = {
  BLOCKING: AlertTriangle,
  HIGH: TriangleAlert,
  MEDIUM: TriangleAlert,
  INFO: Info,
};

function bolivianos(value: unknown, currency: string | null): string {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return '—';
  return `${currency ?? 'Bs'} ${numero.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function porcentaje(value: unknown): string {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return '—';
  return `${(numero * 100).toFixed(1)} %`;
}

export function StatementAffordabilityPanel({ result }: Readonly<{ result: unknown }>) {
  const data = asRecord(result);
  const affordability = asRecord(data.affordability);
  if (Object.keys(affordability).length === 0) return null;

  const coverage = asRecord(affordability.coverage);
  const income = asRecord(affordability.income);
  const expenses = asRecord(affordability.expenses);
  const obligations = asRecord(affordability.obligations);
  const capacity = asRecord(affordability.capacity);
  const signals = asRecord(affordability.signals);
  const months = asRows(affordability.months);
  const reasons = asRows(affordability.reasons);
  const currency = typeof affordability.currency === 'string' ? affordability.currency : null;
  const elegible = affordability.eligible === true;
  const banda = BANDAS[String(affordability.band ?? '')] ?? BANDAS.INSUFICIENTE!;

  return (
    <section className="capacidad" aria-labelledby="capacidad-titulo">
      <header className="capacidad-cabecera">
        <div>
          <h3 className="worker-section-title" id="capacidad-titulo">
            Capacidad de pago
          </h3>
          <p className="field-help">
            Derivada de los movimientos de este extracto, sin nada declarado por el solicitante. El
            motor mide; la política de crédito decide qué hacer con la medida.
          </p>
        </div>
        <div className="capacidad-banda" data-tono={elegible ? banda.tono : 'bad'}>
          <strong>{elegible ? banda.rotulo : 'Sin evaluar'}</strong>
          <span>
            {elegible
              ? `${String(affordability.score ?? 0)} / 100`
              : 'El extracto no cubre los meses exigidos'}
          </span>
        </div>
      </header>

      {/*
        La cobertura va PRIMERO y también cuando todo está bien. Es la condición
        sin la cual nada de lo demás significa algo, y verla en verde es lo que
        permite dar por buena la cifra de abajo sin ir a contar los meses a mano.
      */}
      <p
        className="capacidad-cobertura"
        data-satisfecha={coverage.satisfied === true ? 'si' : 'no'}
      >
        {coverage.satisfied === true ? (
          <CheckCircle2 size={15} aria-hidden="true" />
        ) : (
          <AlertTriangle size={15} aria-hidden="true" />
        )}{' '}
        {String(coverage.monthsComplete ?? 0)} de {String(coverage.minimumMonthsRequired ?? 3)}{' '}
        meses completos exigidos · {String(coverage.from ?? '—')} a {String(coverage.to ?? '—')}
        {Array.isArray(coverage.gapMonths) && coverage.gapMonths.length > 0
          ? ` · sin movimientos en ${(coverage.gapMonths as string[]).join(', ')}`
          : ''}
      </p>

      {elegible ? (
        <>
          <dl className="capacidad-cifras">
            <div>
              <dt>Ingreso reconocido</dt>
              <dd>{bolivianos(income.monthlyRecognized, currency)}</dd>
              <small>
                mediana {bolivianos(income.median, currency)} · media recortada{' '}
                {bolivianos(income.trimmedMean, currency)} · se toma la menor
              </small>
            </div>
            <div>
              <dt>Gasto comprometido</dt>
              <dd>{bolivianos(expenses.effectiveMonthly, currency)}</dd>
              <small>
                {expenses.subsistenceFloorApplied === true
                  ? 'manda el piso de subsistencia: el extracto muestra menos gasto del que cuesta vivir'
                  : `observado ${bolivianos(expenses.committedMonthly, currency)}`}
              </small>
            </div>
            <div>
              <dt>Cuotas con terceros</dt>
              <dd>{bolivianos(obligations.monthly, currency)}</dd>
              <small>{porcentaje(obligations.debtServiceRatio)} del ingreso</small>
            </div>
            <div>
              <dt>Disponible tensionado</dt>
              <dd>{bolivianos(capacity.stressedDisposableIncome, currency)}</dd>
              <small>
                sin tensionar {bolivianos(capacity.disposableIncome, currency)} · el castigo lo pone
                la volatilidad y la tendencia
              </small>
            </div>
            <div className="capacidad-destacada">
              <dt>Cuota máxima sostenible</dt>
              <dd>{bolivianos(capacity.maxAffordableInstallment, currency)}</dd>
              <small>{TOPES[String(capacity.bindingConstraint ?? '')] ?? '—'}</small>
            </div>
            <div>
              <dt>Estabilidad del ingreso</dt>
              <dd>{String(income.stabilityScore ?? 0)} / 100</dd>
              <small>
                variación {porcentaje(income.variability)} · tendencia {porcentaje(income.trend)}{' '}
                por mes
              </small>
            </div>
          </dl>

          {/*
            La serie mensual es la evidencia, no un adorno: es donde se ve si el
            ingreso mediano describe tres meses parecidos o promedia uno bueno
            con dos malos.
          */}
          <div className="worker-table-scroll">
            <table className="data-table capacidad-meses">
              <caption className="sr-only">
                Ingreso reconocido, gasto comprometido y cuotas por mes natural.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Mes</th>
                  <th scope="col">Movs.</th>
                  <th scope="col">Ingreso reconocido</th>
                  <th scope="col">Cuotas</th>
                  <th scope="col">Gasto comprometido</th>
                  <th scope="col">Discrecional</th>
                  <th scope="col">Saldo de cierre</th>
                  <th scope="col">Rechazos</th>
                </tr>
              </thead>
              <tbody>
                {months.map((raw, index) => {
                  const month = raw as UnknownRecord;
                  return (
                    <tr key={index} data-parcial={month.complete === true ? undefined : 'si'}>
                      <th scope="row">
                        {String(month.month ?? '—')}
                        {month.complete === true ? null : <small> · parcial</small>}
                      </th>
                      <td>{String(month.transactionCount ?? 0)}</td>
                      <td>{bolivianos(month.recognizedIncome, currency)}</td>
                      <td>{bolivianos(month.thirdPartyObligations, currency)}</td>
                      <td>{bolivianos(month.committedSpend, currency)}</td>
                      <td>{bolivianos(month.discretionarySpend, currency)}</td>
                      <td>{bolivianos(month.closingBalance, currency)}</td>
                      <td>{String(month.nsfEvents ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="field-help capacidad-descartes">
            Los meses <strong>parciales no entran</strong> en las medianas: tienen la mitad de los
            movimientos, así que bajarían a la vez el ingreso y el gasto y describirían un mes que
            nadie vivió. De los abonos se descartan los traspasos entre cuentas propias, los
            reversos y los desembolsos de crédito
            {typeof signals.internalTransferRatio === 'number' && signals.internalTransferRatio > 0
              ? ` (${porcentaje(signals.internalTransferRatio)} de lo que entró era traspaso propio)`
              : ''}
            .
          </p>
        </>
      ) : null}

      {reasons.length > 0 ? (
        <ul className="capacidad-motivos">
          {reasons.map((raw, index) => {
            const reason = raw as UnknownRecord;
            const severidad = String(reason.severity ?? 'INFO');
            const Icono = SEVERIDAD_ICONO[severidad] ?? Info;
            return (
              <li key={index} data-severidad={severidad.toLowerCase()}>
                <Icono size={15} aria-hidden="true" />
                <div>
                  <strong>{String(reason.message ?? reason.code ?? '')}</strong>
                  <small>
                    <code>{String(reason.code ?? '')}</code>
                    {reason.evidence ? ` · ${String(reason.evidence)}` : ''}
                  </small>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
