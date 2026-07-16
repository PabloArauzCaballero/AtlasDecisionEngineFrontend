import { useQuery } from '@tanstack/react-query';
import { Boxes, Goal, ShieldCheck } from 'lucide-react';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { listResource } from '../resources/resource.api';
import { resources } from '../resources/resource.config';

export function CoveragePage() {
  const query = useQuery({
    queryKey: ['coverage-matrix'],
    queryFn: async () => {
      const [objectives, artifacts] = await Promise.all([
        listResource(resources.objectives, { page: 1, filter: '' }),
        listResource(resources.artifacts, { page: 1, filter: '' }),
      ]);
      const policies = objectives.items.reduce(
        (count, objective) =>
          count + (Array.isArray(objective.policies) ? objective.policies.length : 0),
        0,
      );
      return {
        objectives: objectives.total,
        policies,
        artifacts: artifacts.total,
        objectiveSample: objectives.items,
      };
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Fase 7 · Trazabilidad"
        title="Matriz de cobertura"
        description="Vista consolidada de objetivos, políticas y artefactos que aportan evidencia."
      />
      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}
      <div className="metric-grid three">
        <MetricCard
          label="Objetivos"
          value={String(query.data?.objectives ?? '—')}
          hint="Metas de negocio"
          icon={Goal}
        />
        <MetricCard
          label="Políticas"
          value={String(query.data?.policies ?? '—')}
          hint="Requisitos declarados"
          icon={ShieldCheck}
        />
        <MetricCard
          label="Artefactos"
          value={String(query.data?.artifacts ?? '—')}
          hint="Implementaciones gobernadas"
          icon={Boxes}
        />
      </div>
      {query.data ? (
        <JsonPanel value={query.data.objectiveSample} label="Evidencia de cobertura" />
      ) : null}
    </>
  );
}
