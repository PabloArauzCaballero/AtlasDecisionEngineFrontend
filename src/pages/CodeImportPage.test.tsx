import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { apiRequest } from '../api/http-client';
import { CodeImportPage } from './CodeImportPage';

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../navigation/NavLink', () => ({
  NavLink: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedApiRequest = vi.mocked(apiRequest);

const PYTHON_SOURCE = [
  '# @atlas-contract',
  '# { "contractVersion": "1",',
  '#   "inputs": [{ "id": "edad", "name": "Edad", "type": "INTEGER", "required": true }],',
  '#   "outputs": [',
  '#     { "id": "decision", "name": "Decision", "type": "STRING", "required": true },',
  '#     { "id": "motivo", "name": "Motivo", "type": "STRING", "required": true }],',
  '#   "primaryOutputId": "decision",',
  '#   "reasonOutputId": "motivo" }',
  'edad = variables.get("edad", 0)',
  'if edad < 18:',
  '    result = {"decision": "RECHAZADO", "motivo": "AGE_NOT_ELIGIBLE"}',
  'else:',
  '    result = {"decision": "APROBADO", "motivo": "APPROVED_POLICY"}',
].join('\n');

/** Respuesta del análisis: el árbol ya derivado, sin observaciones del motor. */
const ANALYSIS = {
  id: '12',
  issues: [],
  generatedGraph: {
    dependencies: [
      { variableCode: 'edad', usageType: 'INPUT', dataType: 'INTEGER', required: true },
      { variableCode: 'decision', usageType: 'OUTPUT_PRIMARY', dataType: 'STRING' },
      { variableCode: 'motivo', usageType: 'OUTPUT', dataType: 'STRING' },
    ],
    nodes: [
      { key: 'START', type: 'START', config: {} },
      { key: 'CHECK_1', type: 'CONDITION', label: 'edad < 18', config: {} },
      {
        key: 'RESULT_1',
        type: 'RESULT',
        label: 'Resultado: RECHAZADO',
        config: {
          assignments: [
            { outputCode: 'decision', source: 'LITERAL', value: 'RECHAZADO' },
            { outputCode: 'motivo', source: 'LITERAL', value: 'AGE_NOT_ELIGIBLE' },
          ],
        },
      },
    ],
    edges: [{ key: 'E1', from: 'START', to: 'CHECK_1', default: true }],
    actions: [],
  },
};

/** Catálogo: `edad` y `motivo` existen, `decision` no. */
function catalogFor(path: string): unknown {
  if (path.includes('search=edad')) {
    return { items: [{ id: '1', variableCode: 'edad', name: 'Edad', dataType: 'INTEGER' }] };
  }
  if (path.includes('search=motivo')) {
    return { items: [{ id: '2', variableCode: 'motivo', name: 'Motivo', dataType: 'STRING' }] };
  }
  return { items: [] };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CodeImportPage />
    </QueryClientProvider>,
  );
}

function pasteSource(source: string) {
  fireEvent.change(screen.getByLabelText('Código'), { target: { value: source } });
}

describe('CodeImportPage', () => {
  beforeEach(() => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/v1/code-imports') return ANALYSIS as never;
      if (path.startsWith('/v1/variables/')) return { versions: [] } as never;
      if (path.startsWith('/v1/variables')) return catalogFor(path) as never;
      if (path.startsWith('/v1/reason-codes')) return { items: [] } as never;
      return [] as never;
    });
  });

  it('avisa del lenguaje equivocado antes de analizar y lo corrige de un clic', async () => {
    renderPage();
    // El selector arranca en JavaScript: pegar Python ahí devolvía dos errores del
    // motor que describen mal la causa, sobre un archivo que está bien.
    pasteSource(PYTHON_SOURCE);

    expect(await screen.findByText(/El código pegado es Python/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cambiar el lenguaje a Python/ }));

    await waitFor(() =>
      expect(screen.queryByText(/El código pegado es Python/)).not.toBeInTheDocument(),
    );
    expect(mockedApiRequest).not.toHaveBeenCalledWith('/v1/code-imports', expect.anything());
  });

  it('bloquea el guardado cuando el contrato usa variables o motivos sin declarar', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Lenguaje'), { target: { value: 'PYTHON' } });
    pasteSource(PYTHON_SOURCE);
    fireEvent.click(screen.getByRole('button', { name: 'Analizar' }));

    expect(
      await screen.findByText(/La salida principal «decision» no existe en el inventario/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/El motivo «AGE_NOT_ELIGIBLE».*no está en el catálogo/),
    ).toBeInTheDocument();
    expect(await screen.findByText(/1 de 3 variables del contrato/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Guardar borrador/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled();
  });

  it('deja guardar cuando todo el contrato ya está en los catálogos', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/v1/code-imports') return ANALYSIS as never;
      if (path.startsWith('/v1/variables/')) return { versions: [] } as never;
      if (path.startsWith('/v1/variables')) {
        const code = /search=([^&]+)/.exec(path)?.[1] ?? '';
        return {
          items: [{ id: `id-${code}`, variableCode: code, name: code, dataType: 'STRING' }],
        } as never;
      }
      if (path.startsWith('/v1/reason-codes')) {
        return { items: [{ reasonCode: 'AGE_NOT_ELIGIBLE' }] } as never;
      }
      return [] as never;
    });
    renderPage();
    fireEvent.change(screen.getByLabelText('Lenguaje'), { target: { value: 'PYTHON' } });
    pasteSource(PYTHON_SOURCE);
    fireEvent.click(screen.getByRole('button', { name: 'Analizar' }));

    expect(await screen.findByText(/Las 3 variables del contrato existen/)).toBeInTheDocument();
    // `edad` se declara INTEGER y el catálogo simulado la da como texto: el
    // desajuste de tipo se señala aunque la variable exista.
    expect(await screen.findByText(/«edad».*Número entero.*Texto/)).toBeInTheDocument();
  });
});
