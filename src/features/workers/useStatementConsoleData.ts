'use client';

import { useMemo } from 'react';
import { asRecord, asRows } from '../../utils/records';
import { resumirExtracto, type ResumenExtracto } from './statement-analytics';
import { resumirCategorias } from './statement-category-summary';
import { claveMovimiento, type VeredictoCategoria } from './useStatementCategories';

/**
 * Lo que la consola de extractos DERIVA del resultado del motor.
 *
 * Cuatro cálculos que sólo dependen del resultado y de los veredictos de
 * clasificación, agrupados aquí para que la consola quede siendo lo que es —una
 * composición de paneles— y para poder razonar sobre ellos sin montar la página.
 */
export function useStatementConsoleData(
  result: unknown,
  veredictos: Record<string, VeredictoCategoria>,
) {
  /*
   * Los movimientos que se clasifican, con su SENTIDO.
   *
   * No basta la glosa: el mismo texto aparece como cargo y como abono en el
   * mismo extracto —`TRASPASO ENTRE CAJAS DE AHORRO (MOVIL)` lo hace— y sin el
   * tipo las dos filas compartían veredicto, de modo que un ingreso quedaba
   * rotulado «Transferencia enviada». La deduplicación real la hace el propio
   * hook de categorías, por glosa y sentido.
   */
  const movimientos = useMemo(
    () =>
      asRows(asRecord(result).transactions)
        .map((fila) => ({
          descripcion: String(fila.description ?? ''),
          movementType: String(fila.movementType ?? ''),
        }))
        .filter((movimiento) => movimiento.descripcion !== ''),
    [result],
  );

  const glosas = useMemo(
    () => new Set(movimientos.map((movimiento) => claveMovimiento(movimiento))).size,
    [movimientos],
  );

  /*
   * El reparto por categoría se recalcula mientras la clasificación avanza: cada
   * veredicto que llega mueve una barra, que es la forma honesta de enseñar que
   * el trabajo está ocurriendo —y no una animación inventada sobre datos quietos—.
   */
  const resumen = useMemo(() => resumirCategorias(result, veredictos), [result, veredictos]);

  /*
   * Las cuentas del periodo NO dependen de haber clasificado: suman movimientos.
   * Por eso se calculan aparte y se enseñan siempre, mientras que el reparto por
   * categoría espera a que haya categorías que repartir.
   */
  const cuentas: ResumenExtracto = useMemo(() => resumirExtracto(result), [result]);

  return { movimientos, glosas, resumen, cuentas };
}
