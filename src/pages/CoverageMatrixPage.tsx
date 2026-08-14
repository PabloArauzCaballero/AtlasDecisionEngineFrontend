import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Download, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { ProgressBar } from '../components/ProgressBar';
import { CoverageMatrixGrid } from '../features/governance/CoverageMatrixGrid';
import { buildCoverageMatrix, policyScopes } from '../features/governance/coverage-matrix';
import { useNotifications } from '../notifications/useNotifications';
import { exportResource } from '../resources/resource.api';
import { resources } from '../resources/resource.config';
import { downloadCsv, exportFilename, toCsv } from '../utils/download';

export function CoverageMatrixPage() {
  const query = useQuery({
    queryKey: ['coverage-matrix'],
    queryFn: ({ signal }) => apiRequest<unknown>('/v1/traceability/coverage-matrix', { signal }),
  });
  /**
   * El alcance de cada política se pide aparte porque la matriz no lo trae: sus
   * columnas son la UNIÓN de los códigos del tenant, no los requisitos de cada
   * fila. Sin esto el denominador es la rejilla entera y la cobertura no puede
   * llegar a 100 % ni con toda la evidencia enlazada.
   */
  const scopesQuery = useQuery({
    queryKey: ['coverage-matrix', 'policy-scopes'],
    queryFn: ({ signal }) => exportResource(resources.objectives, { filter: '' }, signal),
  });
  const scopeRows = scopesQuery.data?.rows;
  const matrix = useMemo(
    () => buildCoverageMatrix(query.data, scopeRows ? policyScopes(scopeRows) : null),
    [query.data, scopeRows],
  );
  const { notify } = useNotifications();

  /**
   * Aplana la rejilla a la misma forma que la tabla.
   *
   * Pasa por `toCsv` en vez de armar las líneas a mano. La copia anterior
   * escapaba las celdas pero NO la fila de cabecera, así que un `policyCode` con
   * una coma partía la columna en dos; y ninguna de las dos ramas neutralizaba
   * las fórmulas, que es lo que `toCsv` ya hace por todas las exportaciones.
   */
  const exportMatrix = () => {
    const columns = [
      { key: 'objectiveCode', label: 'Objetivo' },
      { key: 'name', label: 'Nombre' },
      ...matrix.policies.map((policy) => ({ key: policy.policyCode, label: policy.policyCode })),
    ];
    const rows = matrix.rows.map((row) => ({
      objectiveCode: row.objectiveCode,
      name: row.name,
      ...Object.fromEntries(
        row.cells.map((state, index) => [matrix.policies[index]?.policyCode ?? '', state]),
      ),
    }));
    downloadCsv(exportFilename('coverage-matrix', 'csv'), toCsv(rows, columns));
    notify({
      tone: 'success',
      title: 'Matriz exportada',
      description: `${rows.length} objetivos × ${matrix.policies.length} políticas descargados como CSV.`,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="F7-07 · Business Traceability"
        title="Matriz de Cobertura"
        description="Estado de cumplimiento entre objetivos, políticas, artefactos y pruebas."
        actions={
          <>
            <button
              className="button"
              type="button"
              disabled={!matrix.rows.length}
              onClick={exportMatrix}
            >
              <Download size={16} /> Exportar
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                void query.refetch();
                void scopesQuery.refetch();
              }}
              type="button"
            >
              <RefreshCw size={16} /> Sincronizar
            </button>
          </>
        }
      />
      {query.isError ? (
        <Alert tone="error">No fue posible construir la matriz de cobertura.</Alert>
      ) : null}
      {!matrix.scoped && matrix.rows.length ? (
        <Alert tone="warning">
          No se pudo determinar qué política exige cada objetivo, así que los números cuentan la
          rejilla entera —incluidos los cruces que no son un requisito— y la cobertura sale más baja
          de lo que es. Vuelve a sincronizar.
        </Alert>
      ) : null}
      {matrix.scoped && matrix.required > 0 && matrix.complete + matrix.partial === 0 ? (
        <Alert tone="info">
          Los {matrix.required} requisitos declarados existen, pero ninguno tiene todavía un
          artefacto o una suite enlazados: por eso la cobertura es 0 %. Se enlazan con el botón
          «Vincular» de cada política, en el detalle de su objetivo.
        </Alert>
      ) : null}
      <div className="metric-grid three" data-tutorial-id="coverage-matrix-summary">
        <MetricCard
          label="Cobertura"
          value={`${matrix.pct}%`}
          hint="requisitos con artefacto y prueba"
          icon={ShieldCheck}
          tone="success"
        />
        <MetricCard
          label="Evidencia"
          value={`${matrix.complete} / ${matrix.required}`}
          hint={`requisitos completos · ${matrix.partial} parcial${matrix.partial === 1 ? '' : 'es'}`}
          icon={RefreshCw}
        />
        <MetricCard
          label="Huecos"
          value={String(matrix.gaps)}
          hint="sin artefacto ni prueba"
          icon={TriangleAlert}
        />
      </div>
      <section className="panel coverage-matrix">
        <div className="panel-title">
          <span>Trazabilidad: Objetivos vs. Políticas</span>
          <small>Completo · Parcial · Hueco · — no aplica</small>
        </div>
        <CoverageMatrixGrid matrix={matrix} />
        <div className="matrix-progress">
          <span>
            Cobertura total <b>{matrix.pct}%</b>
          </span>
          <ProgressBar value={matrix.pct} label="Cobertura total de objetivos" />
        </div>
      </section>
    </>
  );
}
