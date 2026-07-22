import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, Play, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { PickerSelect } from '../components/PickerSelect';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useNotifications } from '../notifications/useNotifications';
import { CreateTestSuiteForm } from '../testing/CreateTestSuiteForm';
import {
  coveragePercentage,
  queuedTestRunSchema,
  testSuitesPageSchema,
} from '../testing/testing.schemas';
import { display } from '../utils/records';

interface TestSuitesPageProps {
  initialVersionId?: string;
}

export function TestSuitesPage({ initialVersionId = '' }: TestSuitesPageProps) {
  const [draftId, setDraftId] = useState(initialVersionId);
  const [versionId, setVersionId] = useState(initialVersionId);
  const [showCreate, setShowCreate] = useState(false);
  const [batchPending, setBatchPending] = useState(false);
  const router = useRouter();
  const { notify } = useNotifications();
  const query = useQuery({
    queryKey: ['test-suites', versionId],
    queryFn: ({ signal }) =>
      apiRequest(
        `/v1/artifact-versions/${encodeURIComponent(versionId)}/test-suites?page=1&pageSize=50`,
        { signal, responseSchema: testSuitesPageSchema },
      ),
    enabled: Boolean(versionId),
  });
  const run = useMutation({
    mutationFn: (suiteId: string) =>
      apiRequest(`/v1/test-suites/${encodeURIComponent(suiteId)}/runs`, {
        method: 'POST',
        body: { triggerType: 'MANUAL_UI' },
        responseSchema: queuedTestRunSchema,
      }),
  });
  const rows = query.data?.items ?? [];

  const runSuite = async (suiteId: string) => {
    try {
      const queued = await run.mutateAsync(suiteId);
      notify({
        tone: 'success',
        title: `Suite ${suiteId} encolada`,
        description: `Run ${queued.id} está listo para ser procesado por el worker.`,
      });
      router.push(`/test-runs/${queued.id}`);
    } catch {
      // React Query exposes the error through run.error for the page alert.
    }
  };

  const runAll = async () => {
    setBatchPending(true);
    const queuedIds: string[] = [];
    let failures = 0;
    try {
      // Bounded to one request at a time: the backend worker provides the real
      // execution parallelism without flooding the API from the browser.
      for (const suite of rows) {
        try {
          const queued = await run.mutateAsync(suite.id);
          queuedIds.push(queued.id);
        } catch {
          failures += 1;
        }
      }
      notify({
        tone: failures ? 'warning' : 'success',
        title: `${queuedIds.length} suites encoladas`,
        description: failures
          ? `${failures} suites no pudieron encolarse; revisa el error mostrado en la página.`
          : 'El worker las ejecutará con concurrencia controlada.',
        action: queuedIds[0]
          ? { label: 'Ver primer run', onSelect: () => router.push(`/test-runs/${queuedIds[0]}`) }
          : undefined,
      });
    } finally {
      setBatchPending(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="F3-01 · Quality"
        title={`Test Suites${versionId ? ` for v${versionId}` : ''}`}
        description="Suites deterministas, cobertura y gates bloqueantes por versión de artefacto."
        actions={
          <>
            <button
              className="button"
              type="button"
              disabled={!rows.length || batchPending || run.isPending}
              onClick={() => void runAll()}
            >
              {batchPending ? (
                <span className="inline-spinner" aria-hidden="true" />
              ) : (
                <Play size={16} />
              )}
              Run All
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={!versionId}
              aria-expanded={showCreate}
              onClick={() => setShowCreate((visible) => !visible)}
            >
              <Plus size={16} /> Create Suite
            </button>
          </>
        }
      />
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setVersionId(draftId.trim());
        }}
      >
        <PickerSelect
          label="Versión del artefacto"
          value={draftId}
          onChange={setDraftId}
          endpoint="/v1/views/pickers/artifact-versions"
          queryKey="artifact-versions"
          placeholder="Elegir versión…"
          mapOption={(row) => ({
            value: display(row, 'id'),
            label: `${display(row, 'artifactCode')} v${display(row, 'semanticVersion')} · ${display(row, 'status')}`,
          })}
        />
        <button className="button button-primary" type="submit">
          Load suites
        </button>
      </form>
      {showCreate && versionId ? (
        <CreateTestSuiteForm
          versionId={versionId}
          onCancel={() => setShowCreate(false)}
          onCreated={(suite) => {
            setShowCreate(false);
            void query.refetch();
            notify({
              tone: 'success',
              title: `Suite ${suite.suiteCode} creada`,
              description: 'El caso inicial quedó listo para ejecutarse.',
            });
          }}
        />
      ) : null}
      {query.isError || run.isError ? (
        <Alert tone="error">{errorMessage(query.error ?? run.error)}</Alert>
      ) : null}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Bloqueante</th>
                <th>Casos Activos</th>
                <th>Último Resultado</th>
                <th>Cobertura</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((suite) => {
                const latest = suite.runs[0];
                const coverage = coveragePercentage(latest?.coverage ?? [], 'NODE');
                return (
                  <tr key={suite.id}>
                    <td className="mono">{suite.suiteCode}</td>
                    <td>{suite.name}</td>
                    <td>{suite.suiteType}</td>
                    <td>
                      <StatusBadge value={suite.isBlocking ? 'BLOCKING' : 'NON_BLOCKING'} />
                    </td>
                    <td>{suite.cases.filter((item) => item.isActive).length}</td>
                    <td>
                      <StatusBadge value={latest?.status ?? 'NOT_RUN'} />
                    </td>
                    <td className="coverage-cell">
                      <ProgressBar value={coverage} />
                      <span>{coverage.toFixed(1)}%</span>
                    </td>
                    <td>
                      <div className="inline-actions">
                        <button
                          type="button"
                          disabled={run.isPending || batchPending}
                          onClick={() => void runSuite(suite.id)}
                          aria-label={`Ejecutar suite ${suite.id}`}
                        >
                          <Play size={15} />
                        </button>
                        <Link href={`/test-suites/${suite.id}/cases`} aria-label="Ver casos">
                          <Eye size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
