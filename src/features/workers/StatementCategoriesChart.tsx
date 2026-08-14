'use client';

import { formatNumber } from '../../config/locale';
import type {
  CategoriaResumen,
  GrupoCategorias,
  ResumenCategorias,
} from './statement-category-summary';

/**
 * En qué se reparte el dinero del extracto, con los ingresos y los gastos
 * separados.
 *
 * **Dos grupos y no uno.** Mezclar «Sueldo» con «Alquiler» en un único ranking
 * sólo dice cuál se repite más; las preguntas reales son dos —de dónde viene el
 * dinero, en qué se va— y cada una tiene su lista. Comparten escala dentro de su
 * grupo y no entre grupos: comparar el mayor ingreso contra el mayor gasto es
 * una tercera pregunta, y la responde el total escrito en cada cabecera.
 *
 * **Ordenado por importe.** Es lo que convierte la lista de gastos en «los
 * principales gastos»: doce cafés de 20 Bs. no son el gasto principal de un mes
 * con un alquiler de 3.000. El recuento de movimientos sigue escrito al lado.
 *
 * **Barras horizontales y no un anillo.** Lo que se pregunta es de magnitud y
 * comparación, y eso se lee comparando longitudes contra una línea base común.
 * Un donut obliga a comparar ángulos —lo que el ojo hace peor— y deja los
 * rótulos fuera. Horizontales porque los rótulos son texto largo.
 *
 * **Un color por grupo, y el color significa el signo**: es la única distinción
 * que el dibujo tiene que sostener. Dentro de un grupo todas las barras miden lo
 * mismo, así que una paleta por categoría sería decoración. «Sin determinar» va
 * en gris con trama porque no es una categoría, es su ausencia.
 *
 * **El gráfico no es la única forma de leerlo.** Cada barra lleva su rótulo, su
 * importe, su recuento y su porcentaje escritos; la tabla de arriba trae la
 * categoría de cada movimiento. Quitando el color, todo sigue estando.
 */
export function StatementCategoriesChart({ resumen }: { resumen: ResumenCategorias }) {
  const { ingresos, gastos, totalMovimientos, clasificados, categorias } = resumen;
  if (totalMovimientos === 0) return null;

  const cobertura = clasificados / totalMovimientos;

  return (
    <section className="categorias-grafico">
      <header className="categorias-grafico-cabecera">
        <h3 className="worker-section-title">Categorías detectadas</h3>
        <p className="categorias-grafico-resumen">
          <strong>{formatNumber(categorias)}</strong> categorías sobre{' '}
          <strong>{formatNumber(clasificados)}</strong> de {formatNumber(totalMovimientos)}{' '}
          movimientos clasificados ({porcentaje(cobertura)})
        </p>
      </header>

      <div className="categorias-grupos">
        <Grupo grupo={ingresos} />
        <Grupo grupo={gastos} />
      </div>
    </section>
  );
}

function Grupo({ grupo }: { grupo: GrupoCategorias }) {
  return (
    <figure className={`categorias-grupo es-${grupo.sentido}`}>
      <figcaption className="categorias-grupo-cabecera">
        <h4 className="categorias-grupo-titulo">{grupo.titulo}</h4>
        <p className="categorias-grupo-total">
          <strong>{importe(grupo.importe)}</strong>
          <span>
            {formatNumber(grupo.movimientos)}{' '}
            {grupo.movimientos === 1 ? 'movimiento' : 'movimientos'}
          </span>
        </p>
      </figcaption>

      {grupo.filas.length === 0 ? (
        <p className="categorias-grupo-vacio">
          {grupo.sentido === 'ingresos'
            ? 'Ningún abono en el periodo.'
            : 'Ningún cargo en el periodo.'}
        </p>
      ) : (
        <ul className="categorias-barras">
          {grupo.filas.map((fila) => (
            <Barra
              key={fila.codigo ?? fila.etiqueta}
              fila={fila}
              maximo={grupo.maximo}
              total={grupo.importe}
            />
          ))}
        </ul>
      )}
    </figure>
  );
}

function Barra({ fila, maximo, total }: { fila: CategoriaResumen; maximo: number; total: number }) {
  const parte = total === 0 ? 0 : fila.importe / total;
  /*
   * La longitud se escala contra la barra MAYOR del grupo y no contra su total:
   * con una categoría que se lleva el 60 %, las demás quedarían como rayas de
   * dos píxeles indistinguibles. La proporción real no se pierde —va escrita
   * como porcentaje al lado—, y lo que el dibujo tiene que dejar comparar es
   * unas con otras.
   */
  const largo = maximo === 0 ? 0 : (fila.importe / maximo) * 100;
  const sinCategoria = fila.codigo === null;
  const ruta = fila.ruta.length > 1 ? fila.ruta.slice(0, -1).join(' › ') : '';

  return (
    <li
      className={`categorias-barra${sinCategoria ? ' es-sin-categoria' : ''}`}
      title={detalle(fila, parte)}
    >
      <div className="categorias-barra-rotulo">
        <span className="categorias-barra-nombre">{fila.etiqueta}</span>
        {ruta ? <span className="categorias-barra-ruta">{ruta}</span> : null}
      </div>
      <div className="categorias-barra-carril">
        {/* `min-inline-size` para que una categoría con un importe mínimo se
            vea: una barra de 0,3 px es un dato que existe y no se lee. */}
        <span className="categorias-barra-relleno" style={{ inlineSize: `${largo}%` }} />
      </div>
      <div className="categorias-barra-cifras">
        <span className="categorias-barra-importe">{importe(fila.importe)}</span>
        <span className="categorias-barra-parte">
          {porcentaje(parte)} · {formatNumber(fila.movimientos)}
        </span>
      </div>
    </li>
  );
}

/** Lo que se lee al posarse: la ruta entera, el dinero y cuántos movimientos. */
function detalle(fila: CategoriaResumen, parte: number): string {
  const donde = fila.ruta.length > 0 ? fila.ruta.join(' › ') : fila.etiqueta;
  const codigo = fila.codigo ? ` (${fila.codigo})` : '';
  return `${donde}${codigo} · ${importe(fila.importe)} (${porcentaje(parte)}) · ${formatNumber(
    fila.movimientos,
  )} movimientos`;
}

function importe(valor: number): string {
  return formatNumber(valor, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function porcentaje(parte: number): string {
  return `${formatNumber(parte * 100, { maximumFractionDigits: parte < 0.1 ? 1 : 0 })} %`;
}
