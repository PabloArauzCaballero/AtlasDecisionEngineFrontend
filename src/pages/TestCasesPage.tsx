import { useQuery } from '@tanstack/react-query';
import { Download, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { asRows, display } from '../utils/records';

interface TestCasesPageProps {
  initialSuiteId?: string;
}

export function TestCasesPage({ initialSuiteId = '' }: TestCasesPageProps) {
  const [draftId, setDraftId] = useState(initialSuiteId);
  const [suiteId, setSuiteId] = useState(initialSuiteId);
  const query = useQuery({
    queryKey: ['test-cases', suiteId],
    queryFn: ({ signal }) =>
      apiRequest<unknown>(`/v1/test-suites/${encodeURIComponent(suiteId)}/cases`, { signal }),
    enabled: Boolean(suiteId),
  });
  const rows = asRows(query.data);

  return (
    <div className="test-cases-layout">
      <aside className="filters-panel">
        <h2>Filtros</h2>
        {['Etiquetas de Riesgo', 'Áreas del Grafo', 'Estado de Ejecución'].map((group) => (
          <fieldset key={group}>
            <legend>{group}</legend>
            {['Crítico', 'Regresión', 'Activo'].map((option) => (
              <label key={option}>
                <input type="checkbox" /> {option}
              </label>
            ))}
          </fieldset>
        ))}
      </aside>
      <main>
        <PageHeader
          eyebrow="F3-03 · Quality"
          title="Validación de Crédito V2"
          description="Casos de prueba, payloads y resultados esperados de la suite seleccionada."
          actions={
            <>
              <button className="button" type="button">
                <Download size={16} /> Importar CSV
              </button>
              <button className="button" type="button">
                <Plus size={16} /> Agregar Caso
              </button>
              <button className="button button-primary" type="button">
                <Play size={16} /> Ejecutar Suite
              </button>
            </>
          }
        />
        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setSuiteId(draftId);
          }}
        >
          <label>
            <span>Test Suite ID</span>
            <input value={draftId} onChange={(event) => setDraftId(event.target.value)} />
          </label>
          <button className="button button-primary" type="submit">
            Load cases
          </button>
        </form>
        {query.isError ? (
          <Alert tone="error">El backend no pudo devolver los casos de esta suite.</Alert>
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
                  <tr key={display(row, 'id')}>
                    <td className="mono">{display(row, 'caseCode')}</td>
                    <td>{display(row, 'testName')}</td>
                    <td>{display(row, 'tagsJson')}</td>
                    <td className="mono">{display(row, 'inputJson')}</td>
                    <td className="mono">{display(row, 'expectedResultJson')}</td>
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
