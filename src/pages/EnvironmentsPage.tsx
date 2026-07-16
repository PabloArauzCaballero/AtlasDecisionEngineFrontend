import { useQuery } from '@tanstack/react-query';
import { Activity, Plus, RefreshCw, ServerCog } from 'lucide-react';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { asRows, display } from '../utils/records';

export function EnvironmentsPage() {
  const query = useQuery({
    queryKey: ['environments'],
    queryFn: () => apiRequest<unknown>('/v1/environments'),
  });
  const rows = asRows(query.data);
  return (
    <>
      <PageHeader
        eyebrow="F4-06 · Control de Fase 4"
        title="Gestión de Ambientes"
        description="Estado, capacidad y versión desplegada por entorno operativo."
        actions={
          <>
            <button className="button" onClick={() => void query.refetch()} type="button">
              <RefreshCw size={16} /> Actualizar Estado
            </button>
            <button className="button button-primary" type="button">
              <Plus size={16} /> Añadir Ambiente
            </button>
          </>
        }
      />
      {query.isError ? <Alert tone="error">No fue posible consultar los ambientes.</Alert> : null}
      <div className="environment-grid">
        {rows.map((row, index) => (
          <article className={`environment-card env-${index}`} key={display(row, 'id')}>
            <header>
              <ServerCog />
              <div>
                <h2>{display(row, 'name')}</h2>
                <code>{display(row, 'code')}</code>
              </div>
              <StatusBadge value={row.status} />
            </header>
            <dl>
              <div>
                <dt>Versión</dt>
                <dd>{display(row, 'deployedVersion', 'version')}</dd>
              </div>
              <div>
                <dt>Latencia</dt>
                <dd>{display(row, 'latencyMs')} ms</dd>
              </div>
              <div>
                <dt>Uptime</dt>
                <dd>{display(row, 'uptime', 'availability')}</dd>
              </div>
            </dl>
            <ProgressBar
              value={Number(row.capacityPct ?? 0)}
              tone={index === 2 ? 'warning' : 'success'}
            />
            <footer>
              <button className="button" type="button">
                Detalles
              </button>
              <button className="button" type="button">
                <Activity size={15} /> Ver Logs
              </button>
            </footer>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <span>Historial de Despliegues por Ambiente</span>
          <small>Latest activity</small>
        </div>
        <div className="empty-state">Seleccione un ambiente para consultar su historial.</div>
      </section>
    </>
  );
}
