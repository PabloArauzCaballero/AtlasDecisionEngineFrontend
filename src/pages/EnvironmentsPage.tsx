import { useQuery } from '@tanstack/react-query';
import { Activity, Plus, RefreshCw, ServerCog } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { asRecord, asRows, display } from '../utils/records';

export function EnvironmentsPage() {
  const [selectedCode, setSelectedCode] = useState('');
  const query = useQuery({
    queryKey: ['environments'],
    queryFn: () => apiRequest<unknown>('/v1/environments'),
  });
  const rows = asRows(query.data);

  // "Detalles" fills the bottom panel with the selected environment's
  // deployment history; the endpoint has no environment filter, so it is
  // narrowed client-side.
  const deployments = useQuery({
    queryKey: ['environment-deployments', selectedCode],
    queryFn: () => apiRequest<unknown>('/v1/deployments?page=1&pageSize=50'),
    enabled: Boolean(selectedCode),
    select: (data) =>
      asRows(asRecord(data).items).filter(
        (row) => String(row.environmentCode ?? '') === selectedCode,
      ),
  });
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
            <button
              className="button button-primary"
              type="button"
              disabled
              title="El alta de ambientes se gestiona por infraestructura; el Decision Engine aún no expone este endpoint"
            >
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
              <button
                className="button"
                type="button"
                aria-pressed={selectedCode === display(row, 'code')}
                onClick={() => setSelectedCode(display(row, 'code'))}
              >
                Detalles
              </button>
              <Link className="button" href="/executions">
                <Activity size={15} /> Ver Logs
              </Link>
            </footer>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <span>
            Historial de Despliegues{selectedCode ? ` · ${selectedCode}` : ' por Ambiente'}
          </span>
          <small>{deployments.isFetching ? 'Consultando…' : 'Latest activity'}</small>
        </div>
        {!selectedCode ? (
          <div className="empty-state">Seleccione un ambiente para consultar su historial.</div>
        ) : deployments.isError ? (
          <div className="empty-state">No fue posible consultar los despliegues.</div>
        ) : !deployments.data?.length ? (
          <div className="empty-state">
            {deployments.isFetching
              ? 'Cargando historial…'
              : `Sin despliegues registrados para ${selectedCode}.`}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Artefacto</th>
                  <th>Versión</th>
                  <th>Desplegado por</th>
                  <th>Fecha</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {deployments.data.map((row) => (
                  <tr key={display(row, 'id')}>
                    <td className="mono">{display(row, 'artifactCode')}</td>
                    <td>{display(row, 'versionNumber', 'semanticVersion')}</td>
                    <td>{display(row, 'deployedBy')}</td>
                    <td>{display(row, 'deployedAt')}</td>
                    <td>
                      <StatusBadge value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
