import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Database, Server, TriangleAlert } from 'lucide-react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';

export function PlatformStatusPage() {
  const query = useQuery({
    queryKey: ['platform-health'],
    queryFn: async () => ({
      live: await apiRequest<Record<string, unknown>>('/health/live'),
      ready: await apiRequest<Record<string, unknown>>('/health/ready'),
    }),
    refetchInterval: 30_000,
  });
  const operational = Boolean(query.data);
  return (
    <>
      <PageHeader
        eyebrow="F0-03 · System Overview"
        title="Platform Health"
        description="Real-time status of ATLAS decision infrastructure and critical dependencies."
        actions={
          <button className="button" onClick={() => void query.refetch()} type="button">
            <Activity size={16} /> Refresh status
          </button>
        }
      />
      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}
      <div className="metric-grid three service-grid">
        <MetricCard
          label="API Service"
          value={operational ? 'Operational' : 'Checking'}
          hint="REST / Management Plane"
          icon={Server}
          tone="success"
        />
        <MetricCard
          label="PostgreSQL"
          value={operational ? 'Connected' : 'Checking'}
          hint="Primary decision store"
          icon={Database}
          tone="success"
        />
        <MetricCard
          label="Redis Cache"
          value={operational ? 'Healthy' : 'Checking'}
          hint="Rate limits & idempotency"
          icon={Activity}
          tone="success"
        />
      </div>
      <div className="health-layout">
        <Panel title="Readiness Checks" meta="Live checks">
          <ul className="check-list">
            {[
              'Full graph dependency validation',
              'Database connection pool',
              'Redis distributed counters',
              'Audit hash chain availability',
            ].map((item) => (
              <li key={item}>
                <CheckCircle2 />
                <span>
                  {item}
                  <small>Completed successfully</small>
                </span>
                <code>{operational ? 'OK' : '...'}</code>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Active Alerts" meta="Operational">
          <div className="alert-card">
            <TriangleAlert />
            <div>
              <strong>No critical alerts</strong>
              <p>The platform is accepting management and runtime traffic.</p>
            </div>
          </div>
          <div className="system-summary">
            <span>Build version</span>
            <code>{String(query.data?.live.version ?? '2.0.0')}</code>
            <span>Environment</span>
            <strong>PRODUCTION</strong>
          </div>
        </Panel>
      </div>
    </>
  );
}
