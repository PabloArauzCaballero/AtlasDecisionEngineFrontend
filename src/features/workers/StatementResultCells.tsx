'use client';

import { formatNumber } from '../../config/locale';
import { TEXTO_MOTIVO, type MotivoRevision } from './gloss-review';
import type { VeredictoCategoria } from './useStatementCategories';
import type { ColumnasAjustables } from './useResizableColumns';

/**
 * Las celdas de la tabla de movimientos: cabecera ajustable, categoría e importe.
 *
 * Se separaron de `StatementResultView` al pasar aquélla del límite de 299
 * líneas del repositorio. La frontera no es el número: la vista COMPONE la tabla
 * —qué columnas hay y de dónde salen— y esto decide cómo se pinta cada casilla,
 * que es donde vive la mitad de las decisiones difíciles (qué NO se asciende a
 * categoría firme, qué distingue «en revisión» de «no se pudo», por qué un hueco
 * no es un cero).
 */

/**
 * Cabecera con tirador de ancho.
 *
 * El tirador es un `<button>` y no un `<div>`: además de arrastrarse se enfoca
 * con el tabulador y responde a las flechas, que es la única forma de ajustar
 * una columna sin ratón. Su nombre accesible dice qué columna mueve, porque
 * media docena de «Redimensionar» idénticos no orientan a nadie.
 */
export function Cabecera({
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
export function CategoriaCelda({ veredicto }: { veredicto?: VeredictoCategoria }) {
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
  /*
   * «En revisión» NO es «No se pudo», y por eso no comparten ni tono ni palabra.
   *
   * Aquí no ha fallado nada: el motor sigue trabajando y la pantalla dejó de
   * esperar para no bloquear a quien la usa. Pintarlo en rojo junto a los fallos
   * mandaría a reintentar algo que no hay que reintentar, y escondería el único
   * dato accionable —que ese término hay que atenderlo en «Pendientes»—.
   */
  if (veredicto.fase === 'revision') {
    return (
      <span
        className="worker-categoria-revision"
        title={veredicto.motivo ? TEXTO_MOTIVO[veredicto.motivo as MotivoRevision] : undefined}
      >
        En revisión
      </span>
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

export function movementLabel(type: string): string {
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
export function formatAmount(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
