import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw, ServerCog } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { asRecord, asRows, display, resolvePath } from '../utils/records';

export function EnvironmentsPage() {
  const [selectedCode, setSelectedCode] = useState('');
  const query = useQuery({
    queryKey: ['environments'],
    queryFn: () => apiRequest<unknown>('/v1/environments'),
  });
  const rows = asRows(query.data);

  // Deployment history for the selected environment. The backend DOES filter by
  // `environmentCode`, so we let it narrow server-side instead of the previous
  // broken client-side filter (which read a flat `environmentCode` that the
  // deployment rows don't have — the code lives at `environment.code`).
  const deployments = useQuery({
    queryKey: ['environment-deployments', selectedCode],
    queryFn: () =>
      apiRequest<unknown>(
        `/v1/deployments?page=1&pageSize=50&environmentCode=${encodeURIComponent(selectedCode)}`,
      ),
    enabled: Boolean(selectedCode),
    select: (data) => asRows(asRecord(data).items),
  });

  return (
    <>
      <PageHeader
        eyebrow="F4-06 · Control de Fase 4"
        title="Gestión de Ambientes"
        description="Estado, tipo y despliegues por entorno operativo."
        hint="Cada tarjeta es un entorno (sandbox, test, producción). «Detalles» muestra qué versiones se han desplegado ahí y con qué resultado."
        actions={
          <button className="button" onClick={() => void query.refetch()} type="button">
            <RefreshCw size={16} /> Actualizar Estado
          </button>
        }
      />
      {query.isError ? (
        <Alert tone="error">
          No fue posible consultar los ambientes. Requiere rol Platform Admin, Risk, QA o Auditor.
        </Alert>
      ) : null}
      {!query.isPending && !rows.length ? (
        <div className="empty-state">
          <p>No hay ambientes registrados. Los ambientes se aprovisionan desde la plataforma.</p>
        </div>
      ) : null}
      <div className="environment-grid">
        {rows.map((row) => {
          const code = display(row, 'code');
          const isProd = Boolean(row.isProduction);
          return (
            <article
              className={isProd ? 'environment-card env-prod' : 'environment-card'}
              key={code}
            >
              <header>
                <ServerCog />
                <div>
                  <h2>{display(row, 'name')}</h2>
                  <code>{code}</code>
                </div>
                <StatusBadge value={row.status} />
              </header>
              <dl>
                <div>
                  <dt>Tipo</dt>
                  <dd>{display(row, 'environmentType')}</dd>
                </div>
                <div>
                  <dt>Producción</dt>
                  <dd>{isProd ? 'Sí' : 'No'}</dd>
                </div>
                <div>
                  <dt>Creado</dt>
                  <dd>{display(row, 'createdAt')}</dd>
                </div>
              </dl>
              <footer>
                <button
                  className="button"
                  type="button"
                  aria-pressed={selectedCode === code}
                  onClick={() => setSelectedCode(code)}
                >
                  Detalles
                </button>
                <Link className="button" href={`/executions?filter=${encodeURIComponent(code)}`}>
                  <Activity size={15} /> Ver Logs
                </Link>
              </footer>
            </article>
          );
        })}
      </div>
      <section className="panel">
        <div className="panel-title">
          <span>
            Historial de Despliegues{selectedCode ? ` · ${selectedCode}` : ' por Ambiente'}
          </span>
          <small>{deployments.isFetching ? 'Consultando…' : 'Actividad reciente'}</small>
        </div>
        {!selectedCode ? (
          <div className="empty-state">Selecciona un ambiente para ver su historial.</div>
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
                    <td className="mono">
                      {String(resolvePath(row, 'artifactVersion.artifact.artifactCode') ?? '—')}
                    </td>
                    <td>{String(resolvePath(row, 'artifactVersion.versionNumber') ?? '—')}</td>
                    <td>{display(row, 'deployedBy')}</td>
                    <td>{display(row, 'deployedAt')}</td>
                    <td>
                      <StatusBadge value={row.deploymentStatus ?? row.status} />
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
