'use client';

import { StatementAnalytics } from './StatementAnalytics';
import { StatementCategoriesBar } from './StatementCategoriesBar';
import { StatementCategoriesChart } from './StatementCategoriesChart';
import { StatementResultView } from './StatementResultView';
import { useStatementCategories } from './useStatementCategories';
import { useStatementConsoleData } from './useStatementConsoleData';

/**
 * El ejercicio completo sobre lo leído de un extracto en revisión: cuánto entró y salió, la capacidad
 * de pago, los movimientos y —a demanda— sus categorías.
 *
 * Pablo (2026-10-15): «que haga el ejercicio que ya sabe hacer: identificar los ingresos, gastos y
 * categorías». Es la misma composición que la consola del worker, con las mismas piezas: quien revisa
 * decide con lo mismo que ve quien prueba un extracto. Clasificar sigue siendo un paso aparte porque
 * son N ejecuciones del worker semántico.
 */
export function StatementReviewAnalysis({
  result,
  warnings,
}: {
  result: unknown;
  warnings?: unknown;
}) {
  const categorias = useStatementCategories();
  const { movimientos, glosas, resumen, cuentas } = useStatementConsoleData(
    result,
    categorias.veredictos,
  );
  return (
    <>
      {glosas > 0 ? (
        <StatementCategoriesBar
          glosas={glosas}
          corriendo={categorias.corriendo}
          hechas={categorias.hechas}
          total={categorias.total}
          demasiadas={categorias.demasiadas}
          maxGlosas={categorias.maxGlosas}
          onClasificar={() => void categorias.clasificar(movimientos)}
          onParar={categorias.parar}
        />
      ) : null}
      <StatementAnalytics resumen={cuentas} />
      <StatementResultView
        result={result}
        warnings={warnings}
        categorias={categorias.total > 0 ? categorias.veredictos : undefined}
      />
      {categorias.total > 0 ? <StatementCategoriesChart resumen={resumen} /> : null}
    </>
  );
}
