'use client';

import { formatNumber } from '../../config/locale';
import {
  descuadreRelevante,
  type MovimientoDestacado,
  type ResumenExtracto,
} from './statement-analytics';

/**
 * El estado de cuenta del periodo: cuánto entró, cuánto salió, qué quedó.
 *
 * Va ANTES de la tabla y del reparto por categorías porque es la pregunta que
 * se hace primero, y porque no depende de haber clasificado nada: suma
 * movimientos, no categorías. El gráfico de abajo responde «en qué se reparte»;
 * esto responde «cuánto».
 *
 * Los saldos del banco se enseñan al lado y no se suman a los totales: unos los
 * imprime el documento y los otros salen de los movimientos. Cuando las dos
 * cuentas no cuadran se DICE, porque ese descuadre significa que al extracto le
 * faltan movimientos —y quien esté midiendo capacidad de pago con esto tiene que
 * saberlo antes de usarlo, no después—.
 */
export function StatementAnalytics({ resumen }: { resumen: ResumenExtracto }) {
  const { ingresos, gastos, neto, saldoInicial, saldoFinal } = resumen;
  const total = ingresos + gastos;

  return (
    <section className="extracto-resumen">
      <h3 className="worker-section-title">Resumen del periodo</h3>

      <div className="extracto-cuentas">
        <Cifra
          titulo="Ingresos"
          valor={ingresos}
          detalle={`${formatNumber(resumen.movimientosIngreso)} ${
            resumen.movimientosIngreso === 1 ? 'movimiento' : 'movimientos'
          }`}
          tono="ingresos"
        />
        <Cifra
          titulo="Gastos"
          valor={gastos}
          detalle={`${formatNumber(resumen.movimientosGasto)} ${
            resumen.movimientosGasto === 1 ? 'movimiento' : 'movimientos'
          }`}
          tono="gastos"
        />
        <Cifra
          titulo="Neto del periodo"
          valor={neto}
          detalle={neto >= 0 ? 'Entró más de lo que salió' : 'Salió más de lo que entró'}
          tono="neto"
          conSigno
        />
        <Cifra
          titulo="Saldos del banco"
          valor={saldoFinal}
          detalle={
            saldoInicial === null
              ? 'El documento no publica el saldo inicial'
              : `Desde ${importe(saldoInicial)}`
          }
          tono="saldo"
        />
      </div>

      {/* Una barra, no un anillo: la comparación es de dos magnitudes contra su
          suma, y así se ve de un vistazo cuál pesa más sin leer las cifras. */}
      {total > 0 ? (
        <div
          className="extracto-balanza"
          role="img"
          aria-label={`Ingresos ${importe(ingresos)} frente a gastos ${importe(gastos)}`}
        >
          <span
            className="extracto-balanza-ingresos"
            style={{ inlineSize: `${(ingresos / total) * 100}%` }}
          />
          <span
            className="extracto-balanza-gastos"
            style={{ inlineSize: `${(gastos / total) * 100}%` }}
          />
        </div>
      ) : null}

      {descuadreRelevante(resumen) ? (
        <p className="extracto-descuadre">
          Los saldos del banco varían {importe((saldoFinal ?? 0) - (saldoInicial ?? 0))} y los
          movimientos leídos suman {importe(neto)}: faltan {importe(resumen.descuadre ?? 0)} por
          explicar. Conviene contrastarlo con el documento antes de usar estos totales.
        </p>
      ) : null}

      <div className="extracto-destacados">
        <Destacados titulo="Principales ingresos" filas={resumen.mayoresIngresos} />
        <Destacados titulo="Principales gastos" filas={resumen.mayoresGastos} />
      </div>
    </section>
  );
}

function Cifra({
  titulo,
  valor,
  detalle,
  tono,
  conSigno = false,
}: {
  titulo: string;
  valor: number | null;
  detalle: string;
  tono: string;
  conSigno?: boolean;
}) {
  return (
    <article className={`extracto-cifra es-${tono}`}>
      <span className="extracto-cifra-titulo">{titulo}</span>
      <strong className="extracto-cifra-valor">
        {valor === null ? '—' : `${conSigno && valor > 0 ? '+' : ''}${importe(valor)}`}
      </strong>
      <span className="extracto-cifra-detalle">{detalle}</span>
    </article>
  );
}

/**
 * Los mayores de cada lado. Se listan con su fecha y su glosa entera, que es lo
 * que permite reconocer el movimiento sin ir a buscarlo a la tabla.
 */
function Destacados({ titulo, filas }: { titulo: string; filas: readonly MovimientoDestacado[] }) {
  return (
    <div className="extracto-destacado">
      <h4 className="extracto-destacado-titulo">{titulo}</h4>
      {filas.length === 0 ? (
        <p className="extracto-destacado-vacio">Ninguno en el periodo.</p>
      ) : (
        <ol className="extracto-destacado-lista">
          {filas.map((fila, indice) => (
            <li key={`${fila.fecha}-${indice}`}>
              <span className="extracto-destacado-glosa" title={fila.descripcion}>
                {fila.descripcion || 'Sin glosa'}
              </span>
              <span className="extracto-destacado-cifra">
                <strong>{importe(fila.importe)}</strong>
                <small>{fila.fecha || '—'}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function importe(valor: number): string {
  return formatNumber(valor, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
