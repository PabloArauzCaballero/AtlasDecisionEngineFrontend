import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Play, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ChangeEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { PickerSelect } from '../components/PickerSelect';
import { StatusBadge } from '../components/StatusBadge';
import { useNotifications } from '../notifications/useNotifications';
import { CreateTestCaseForm } from '../testing/CreateTestCaseForm';
import { parseTestCasesCsv, type CsvTestCasePayload } from '../testing/test-cases.csv';
import {
  importedTestCasesSchema,
  queuedTestRunSchema,
  testCasesSchema,
} from '../testing/testing.schemas';
import { asRecord, asRows, display } from '../utils/records';

interface TestCasesPageProps {
  initialSuiteId?: string;
}

const SUITE_PICKER_ENDPOINT = '/v1/views/pickers/test-suites';

function displayJson(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function TestCasesPage({ initialSuiteId = '' }: TestCasesPageProps) {
  const [draftId, setDraftId] = useState(initialSuiteId);
  const [suiteId, setSuiteId] = useState(initialSuiteId);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { notify } = useNotifications();
  const query = useQuery({
    queryKey: ['test-cases', suiteId],
    queryFn: ({ signal }) =>
      apiRequest(`/v1/test-suites/${encodeURIComponent(suiteId)}/cases`, {
        signal,
        responseSchema: testCasesSchema,
      }),
    enabled: Boolean(suiteId),
  });
  // La versión que la suite prueba, para poder generar una entrada de ejemplo con SU
  // contrato. Se lee de la misma consulta que alimenta el selector —misma clave, así que
  // es un acierto de caché— y no de la opción elegida: la suite puede venir fijada por la
  // URL sin que nadie haya tocado el selector.
  const suitePicker = useQuery({
    queryKey: ['picker', 'test-suites', SUITE_PICKER_ENDPOINT],
    queryFn: () => apiRequest<unknown>(SUITE_PICKER_ENDPOINT),
    staleTime: 60_000,
  });
  const suiteRows = Array.isArray(suitePicker.data)
    ? asRows(suitePicker.data)
    : asRows(asRecord(suitePicker.data).items);
  const artifactVersionId = suiteRows.find(
    (row) => display(row, 'id') === suiteId,
  )?.artifactVersionId;

  const run = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/test-suites/${encodeURIComponent(suiteId)}/runs`, {
        method: 'POST',
        body: { triggerType: 'MANUAL_UI' },
        responseSchema: queuedTestRunSchema,
      }),
    onSuccess: (queued) => {
      notify({
        tone: 'success',
        title: `Run ${queued.id} encolado`,
        description: 'La vista de resultados se actualizará mientras el worker ejecuta los casos.',
      });
      router.push(`/test-runs/${queued.id}`);
    },
  });
  const importCases = useMutation({
    mutationFn: (cases: CsvTestCasePayload[]) =>
      apiRequest(`/v1/test-suites/${encodeURIComponent(suiteId)}/cases/import`, {
        method: 'POST',
        body: { cases },
        responseSchema: importedTestCasesSchema,
      }),
    onSuccess: (created) => {
      setImportError(null);
      void query.refetch();
      notify({
        tone: 'success',
        title: `${created.length} casos importados`,
        description: `Los casos quedaron asociados a la suite ${suiteId}.`,
      });
    },
  });

  const normalizedSearch = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter((testCase) => {
    if (activeOnly && !testCase.isActive) return false;
    return (
      !normalizedSearch ||
      testCase.caseCode.toLowerCase().includes(normalizedSearch) ||
      testCase.testName.toLowerCase().includes(normalizedSearch) ||
      displayJson(testCase.tagsJson).toLowerCase().includes(normalizedSearch)
    );
  });

  const readCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setImportError(null);
      await importCases.mutateAsync(parseTestCasesCsv(await file.text()));
    } catch (error) {
      setImportError(errorMessage(error));
    }
  };

  return (
    <div className="test-cases-layout">
      <aside className="filters-panel">
        <h2>Filtros</h2>
        <label className="field">
          <span>Buscar caso o tag</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(event) => setActiveOnly(event.target.checked)}
          />{' '}
          Solo casos activos
        </label>
        <small>
          CSV: caseCode, testName, inputJson, expectedResultJson; tagsJson e isActive son
          opcionales.
        </small>
      </aside>
      <main>
        <PageHeader
          eyebrow="F3-03 · Quality"
          title={suiteId ? `Casos de la suite ${suiteId}` : 'Casos de prueba'}
          description="Casos deterministas, payloads y resultados esperados de la suite seleccionada."
          actions={
            <>
              <input
                ref={fileInput}
                hidden
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void readCsv(event)}
              />
              <button
                className="button"
                type="button"
                disabled={!suiteId || importCases.isPending}
                onClick={() => fileInput.current?.click()}
              >
                <Download size={16} /> {importCases.isPending ? 'Importando…' : 'Importar CSV'}
              </button>
              <button
                className="button"
                type="button"
                disabled={!suiteId}
                aria-expanded={showCreate}
                onClick={() => setShowCreate((visible) => !visible)}
              >
                <Plus size={16} /> Agregar Caso
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={!suiteId || run.isPending}
                onClick={() => run.mutate()}
              >
                <Play size={16} /> {run.isPending ? 'Encolando…' : 'Ejecutar Suite'}
              </button>
            </>
          }
        />
        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setSuiteId(draftId.trim());
            setShowCreate(false);
          }}
        >
          <PickerSelect
            label="Suite de pruebas"
            value={draftId}
            onChange={setDraftId}
            endpoint={SUITE_PICKER_ENDPOINT}
            queryKey="test-suites"
            placeholder="Elegir suite…"
            mapOption={(row) => ({
              value: display(row, 'id'),
              label: `${display(row, 'suiteCode')} · ${display(row, 'artifactCode')} v${display(row, 'versionNumber')}`,
            })}
          />
          <button className="button button-primary" type="submit">
            Cargar casos
          </button>
        </form>
        {showCreate && suiteId ? (
          <CreateTestCaseForm
            suiteId={suiteId}
            artifactVersionId={artifactVersionId ? String(artifactVersionId) : undefined}
            onCancel={() => setShowCreate(false)}
            onCreated={(testCase) => {
              setShowCreate(false);
              void query.refetch();
              notify({
                tone: 'success',
                title: `Caso ${testCase.caseCode} creado`,
                description: 'El caso ya está disponible para la próxima ejecución.',
              });
            }}
          />
        ) : null}
        {query.isError || run.isError || importCases.isError || importError ? (
          <Alert tone="error">
            {importError ?? errorMessage(query.error ?? run.error ?? importCases.error)}
          </Alert>
        ) : null}
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID Caso</th>
                  <th>Nombre del Escenario</th>
                  <th>Tags</th>
                  <th>Entrada (Payload)</th>
                  <th>Resultado Esperado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.caseCode}</td>
                    <td>{row.testName}</td>
                    <td>{displayJson(row.tagsJson)}</td>
                    <td className="mono">{displayJson(row.inputJson)}</td>
                    <td className="mono">{displayJson(row.expectedResultJson)}</td>
                    <td>
                      <StatusBadge value={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
