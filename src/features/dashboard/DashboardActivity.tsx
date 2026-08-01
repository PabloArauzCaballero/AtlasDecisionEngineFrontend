import Link from 'next/link';
import { ConceptIcon } from '../../components/ConceptIcon';
import { EmptyState } from '../../components/EmptyState';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { display, type UnknownRecord } from '../../utils/records';
import { isFailedExecution, isPending, type DashboardSnapshot } from './dashboard.api';

/**
 * Actividad reciente y cosas que piden atención.
 *
 * Sólo se pinta lo que el backend devolvió: si no hay ejecuciones, se explica
 * qué es una ejecución y cómo generar la primera, en lugar de dejar una tabla
 * vacía que parece un error.
 */
export function DashboardActivity({ data }: { data: DashboardSnapshot }) {
  const attention = [
    ...data.failedExecutions.map((row) => ({
      key: `exec-${display(row, 'id', 'requestId')}`,
      concept: 'execution' as const,
      title: `Ejecución ${display(row, 'requestId', 'id')}`,
      detail: 'Terminó con error y conviene revisar en qué nodo falló.',
      href: `/executions/${encodeURIComponent(display(row, 'id', 'requestId'))}`,
      tone: 'danger' as const,
    })),
    ...data.manualReviews.items.filter(isPending).map((row) => ({
      key: `review-${display(row, 'id', 'caseId')}`,
      concept: 'manualReview' as const,
      title: `Caso ${display(row, 'caseId', 'id')} en revisión manual`,
      detail: 'Una persona debe resolver este caso para que la decisión avance.',
      href: `/manual-reviews/${encodeURIComponent(display(row, 'id', 'caseId'))}`,
      tone: 'warning' as const,
    })),
    ...data.approvals.items.filter(isPending).map((row) => ({
      key: `approval-${display(row, 'id')}`,
      concept: 'approval' as const,
      title: `Aprobación pendiente ${display(row, 'id')}`,
      detail: 'Una versión espera autorización para poder desplegarse.',
      href: `/approval-requests/${encodeURIComponent(display(row, 'id'))}`,
      tone: 'warning' as const,
    })),
  ].slice(0, 6);

  return (
    <div className="dash-activity">
      <Panel title="Ejecuciones recientes" meta={`Últimas ${data.executions.items.length}`}>
        {data.executions.items.length ? (
          <ul className="dash-feed stagger-in">
            {data.executions.items.map((row) => (
              <ExecutionRow key={display(row, 'id', 'requestId')} row={row} />
            ))}
          </ul>
        ) : (
          <EmptyState
            illustration="empty"
            title="Todavía no hay ejecuciones registradas"
            description="Una ejecución es una decisión ya resuelta por el motor, con el recorrido completo de nodos que siguió."
            example="Puedes generar la primera lanzando una simulación con datos de prueba."
            actions={
              <Link className="button button-primary" href="/simulator">
                Abrir el simulador
              </Link>
            }
          />
        )}
      </Panel>

      <Panel title="Requiere atención" meta={`${attention.length} elementos`}>
        {attention.length ? (
          <ul className="dash-attention stagger-in">
            {attention.map((item) => (
              <li key={item.key} className={`dash-attention-${item.tone}`}>
                <ConceptIcon concept={item.concept} tone={item.tone} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <Link className="button" href={item.href}>
                  Revisar
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            illustration="success"
            tone="success"
            title="Nada pendiente por ahora"
            description="No hay ejecuciones fallidas recientes, casos en revisión manual ni aprobaciones esperando autorización."
          />
        )}
      </Panel>
    </div>
  );
}

function ExecutionRow({ row }: { row: UnknownRecord }) {
  const id = display(row, 'id', 'requestId');
  const failed = isFailedExecution(row);
  return (
    <li className={failed ? 'dash-feed-failed' : ''}>
      <ConceptIcon concept="execution" tone={failed ? 'danger' : 'success'} decorative />
      <span>
        <strong>{display(row, 'artifactCode', 'requestId')}</strong>
        <small>
          {display(row, 'environmentCode')} · {display(row, 'createdAt', 'timestamp')}
        </small>
      </span>
      <StatusBadge value={row.status ?? row.outcome} />
      <Link className="dash-feed-link" href={`/executions/${encodeURIComponent(id)}`}>
        Reproducir
      </Link>
    </li>
  );
}
