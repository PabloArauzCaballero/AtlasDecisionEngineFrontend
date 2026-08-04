'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import type { AmbientState } from '../components/AmbientBackground';
import { useAmbientState } from '../components/ambient/useAmbientState';
import { ConceptIcon } from '../components/ConceptIcon';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { DashboardActivity } from '../features/dashboard/DashboardActivity';
import { DashboardCard } from '../features/dashboard/DashboardCard';
import { fetchDashboard, isPending } from '../features/dashboard/dashboard.api';
import { PlatformHealthPanels } from '../features/dashboard/PlatformHealthPanels';
import { display } from '../utils/records';

const QUICK_ACCESS = [
  { concept: 'simulation', label: 'Simular una decisión', href: '/simulator' },
  { concept: 'algorithm', label: 'Editar un algoritmo', href: '/graph-editor' },
  { concept: 'testSuite', label: 'Suites de prueba', href: '/test-suites' },
  { concept: 'deployment', label: 'Despliegues', href: '/deployments' },
  { concept: 'audit', label: 'Auditar ejecuciones', href: '/executions' },
  { concept: 'objective', label: 'Objetivos de negocio', href: '/objectives' },
] as const;

/**
 * Panel de inicio.
 *
 * Reúne el estado real de la infraestructura y el volumen real de trabajo de la
 * plataforma. El fondo ambiental cambia de temperatura según ese estado —azul
 * mientras consulta, rojo si el backend no responde, ámbar si hay trabajo
 * humano pendiente— de modo que el color comunica algo verdadero y no adorna.
 */
export function PlatformStatusPage() {
  const health = useQuery({
    queryKey: ['platform-health'],
    queryFn: async ({ signal }) => ({
      live: await apiRequest<Record<string, unknown>>('/health/live', { signal }),
      ready: await apiRequest<Record<string, unknown>>('/health/ready', { signal }),
    }),
    refetchInterval: 30_000,
  });
  const dashboard = useQuery({
    queryKey: ['dashboard-snapshot'],
    queryFn: ({ signal }) => fetchDashboard(signal),
    refetchInterval: 60_000,
  });

  const operational = Boolean(health.data);
  const data = dashboard.data;
  const pendingWork =
    (data?.manualReviews.items.filter(isPending).length ?? 0) +
    (data?.approvals.items.filter(isPending).length ?? 0);
  const failures = data?.failedExecutions.length ?? 0;

  const ambientState: AmbientState = health.isError
    ? 'error'
    : health.isFetching || dashboard.isFetching
      ? 'running'
      : failures > 0
        ? 'error'
        : pendingWork > 0
          ? 'warning'
          : 'success';
  useAmbientState(ambientState);

  const environments = (data?.environments.items ?? [])
    .map((row) => display(row, 'code', 'environmentCode', 'name'))
    .filter((code) => code !== '—');

  const refresh = () => {
    void health.refetch();
    void dashboard.refetch();
  };

  return (
    <>
      <PageHeader
        eyebrow="F0-03 · Panel de inicio"
        title="Estado de la plataforma"
        description="Salud de la infraestructura de decisión y volumen real de trabajo en curso."
        hint="Todo lo que ves aquí se lee del backend en vivo. Un guion significa que ese dato no estuvo disponible al consultar."
        actions={
          <button className="button" onClick={refresh} type="button">
            <RefreshCw
              size={16}
              className={health.isFetching || dashboard.isFetching ? 'spin' : undefined}
              aria-hidden="true"
            />
            Actualizar
          </button>
        }
      />

      {health.isError ? <Alert tone="error">{errorMessage(health.error)}</Alert> : null}

      <div className="dash-grid stagger-in" data-tutorial-id="dashboard-metrics">
        <DashboardCard
          concept="artifact"
          label="Artefactos de decisión"
          value={data?.artifacts.total ?? null}
          hint="Algoritmos registrados en el catálogo."
          tone="accent"
          href="/artifacts"
          actionLabel="Ver catálogo"
        />
        <DashboardCard
          concept="execution"
          label="Ejecuciones registradas"
          value={data?.executions.total ?? null}
          hint="Decisiones resueltas y auditadas por el motor."
          tone="info"
          href="/executions"
          actionLabel="Auditar"
        />
        <DashboardCard
          concept="alert"
          label="Fallos recientes"
          value={data ? failures : null}
          hint="Ejecuciones recientes que terminaron con error."
          tone={failures > 0 ? 'danger' : 'success'}
          href="/executions"
          actionLabel="Revisar"
        />
        <DashboardCard
          concept="manualReview"
          label="Trabajo humano pendiente"
          value={data ? pendingWork : null}
          hint="Casos en revisión manual y aprobaciones esperando decisión."
          tone={pendingWork > 0 ? 'warning' : 'success'}
          href="/manual-reviews"
          actionLabel="Atender"
        />
        <DashboardCard
          concept="testSuite"
          label="Suites ejecutadas"
          value={data?.testQuality.concluded ?? null}
          hint="Ejecuciones de suites de prueba que ya terminaron."
          tone="accent"
          href="/test-suites"
          actionLabel="Abrir QA LAB"
        />
        <DashboardCard
          concept="coverage"
          label="Pruebas aprobadas"
          value={data?.testQuality.passRate ?? null}
          suffix=" %"
          decimals={1}
          hint="Suites aprobadas sobre las ejecuciones de prueba ya concluidas."
          tone={(data?.testQuality.passRate ?? 100) >= 90 ? 'success' : 'warning'}
          href="/graph-coverage"
          actionLabel="Ver cobertura"
        />
        <DashboardCard
          concept="deployment"
          label="Despliegues"
          value={data?.deployments.total ?? null}
          hint="Publicaciones de versiones en ambientes."
          tone="neutral"
          href="/deployments"
          actionLabel="Ver historial"
        />
        <DashboardCard
          concept="environment"
          label="Ambientes"
          value={data?.environments.total ?? null}
          hint="Espacios donde puede ejecutarse una versión."
          tone="neutral"
          href="/environments"
          actionLabel="Configurar"
        />
      </div>

      {dashboard.isError ? (
        <Alert tone="warning">
          No se pudieron cargar todas las métricas del panel. Las tarjetas con un guion no
          recibieron respuesta del backend.
        </Alert>
      ) : null}

      {data ? <DashboardActivity data={data} /> : null}

      <PlatformHealthPanels
        live={health.data?.live}
        ready={health.data?.ready}
        operational={operational}
        loading={health.isFetching}
        environments={environments}
      />

      <Panel title="Accesos rápidos" meta="Las operaciones más habituales">
        <div className="dash-shortcuts">
          {QUICK_ACCESS.map((item) => (
            <Link key={item.href} className="dash-shortcut" href={item.href}>
              <ConceptIcon concept={item.concept} tone="accent" decorative />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}
