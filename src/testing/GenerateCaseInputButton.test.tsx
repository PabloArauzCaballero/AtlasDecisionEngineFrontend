import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { apiRequest } from '../api/http-client';
import { CreateTestCaseForm } from './CreateTestCaseForm';

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

function renderForm(artifactVersionId?: string, suiteTypeCode?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CreateTestCaseForm
        suiteId="7"
        artifactVersionId={artifactVersionId}
        suiteTypeCode={suiteTypeCode}
        onCreated={vi.fn()}
        onCancel={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

/**
 * Abre la vista JSON del editor pedido y devuelve su área de texto.
 *
 * El editor arranca en «Formulario», que es lo que se quiere delante al crear un
 * caso; el JSON sigue estando y es donde se comprueba el valor exacto.
 */
function jsonTextarea(editorId: string) {
  const editor = document.querySelector(`[data-editor="${editorId}"]`) as HTMLElement;
  fireEvent.click(within(editor).getByRole('tab', { name: 'JSON' }));
  return editor.querySelector('textarea') as HTMLTextAreaElement;
}

describe('Generar entrada de un caso de prueba', () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it('pide el lote a la versión de la suite y lo escribe en la entrada', async () => {
    mockedApiRequest.mockResolvedValue({
      seed: 'z9x',
      cases: [{ input: { ingreso_mensual: 4200, edad: 33 } }],
    } as never);
    renderForm('55');

    fireEvent.click(screen.getByRole('button', { name: /Generar entrada/ }));

    await waitFor(() => expect(screen.getByText(/semilla z9x/)).toBeInTheDocument());
    expect(jsonTextarea('new-case-input')).toHaveValue(
      JSON.stringify({ ingreso_mensual: 4200, edad: 33 }, null, 2),
    );
    const sampleCall = mockedApiRequest.mock.calls.find(([path]) =>
      String(path).includes('/sample-inputs'),
    );
    expect(sampleCall?.[0]).toBe('/v1/qa-lab/versions/55/sample-inputs');
    expect(sampleCall?.[1]?.body).toMatchObject({ kind: 'VALID', count: 1 });
  });

  it('la clase de valores la decide el TIPO de suite, no la última elección', async () => {
    mockedApiRequest.mockResolvedValue({ seed: 's', cases: [{ input: {} }] } as never);
    // Una suite generada del contrato se siembra en el límite: es donde
    // aparecen los defectos, y un barrido de casos cómodos no encuentra nada.
    renderForm('55', 'GENERATED');

    fireEvent.click(screen.getByRole('button', { name: /Generar entrada/ }));

    await waitFor(() => expect(screen.getByText(/semilla s/)).toBeInTheDocument());
    const sampleCall = mockedApiRequest.mock.calls.find(([path]) =>
      String(path).includes('/sample-inputs'),
    );
    expect(sampleCall?.[1]?.body).toMatchObject({ kind: 'BOUNDARY' });
  });

  it('no toca el resultado esperado: eso es lo que la prueba afirma', async () => {
    mockedApiRequest.mockResolvedValue({ seed: 's', cases: [{ input: { edad: 20 } }] } as never);
    renderForm('55');

    fireEvent.click(screen.getByRole('button', { name: /Generar entrada/ }));

    await waitFor(() => expect(screen.getByText(/semilla s/)).toBeInTheDocument());
    expect(jsonTextarea('new-case-expected')).toHaveValue('{}');
  });

  it('sin versión conocida no ofrece el botón, en vez de generar contra otra cosa', () => {
    renderForm(undefined);
    expect(screen.queryByRole('button', { name: /Generar entrada/ })).not.toBeInTheDocument();
  });

  it('un fallo del backend se muestra y no deja la entrada a medias', async () => {
    mockedApiRequest.mockRejectedValue(new Error('La versión no está compilada'));
    renderForm('55');

    fireEvent.click(screen.getByRole('button', { name: /Generar entrada/ }));

    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(jsonTextarea('new-case-input')).toHaveValue('{}');
  });
});
