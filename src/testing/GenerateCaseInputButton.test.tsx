import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiRequest } from '../api/http-client';
import { CreateTestCaseForm } from './CreateTestCaseForm';

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

function renderForm(artifactVersionId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CreateTestCaseForm
        suiteId="7"
        artifactVersionId={artifactVersionId}
        onCreated={vi.fn()}
        onCancel={vi.fn()}
      />
    </QueryClientProvider>,
  );
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

    await waitFor(() =>
      expect(screen.getByLabelText(/Entrada \(JSON\)/)).toHaveValue(
        JSON.stringify({ ingreso_mensual: 4200, edad: 33 }, null, 2),
      ),
    );
    expect(mockedApiRequest.mock.calls[0][0]).toBe('/v1/qa-lab/versions/55/sample-inputs');
    expect(mockedApiRequest.mock.calls[0][1]?.body).toMatchObject({ kind: 'VALID', count: 1 });
  });

  it('no toca el resultado esperado: eso es lo que la prueba afirma', async () => {
    mockedApiRequest.mockResolvedValue({ seed: 's', cases: [{ input: { edad: 20 } }] } as never);
    renderForm('55');

    fireEvent.click(screen.getByRole('button', { name: /Generar entrada/ }));

    await waitFor(() => expect(screen.getByText(/semilla s/)).toBeInTheDocument());
    expect(screen.getByLabelText(/Resultado esperado \(JSON\)/)).toHaveValue('{}');
  });

  it('sin versión conocida no ofrece el botón, en vez de generar contra otra cosa', () => {
    renderForm(undefined);
    expect(screen.queryByRole('button', { name: /Generar entrada/ })).not.toBeInTheDocument();
  });

  it('un fallo del backend se muestra y no deja la entrada a medias', async () => {
    mockedApiRequest.mockRejectedValue(new Error('La versión no está compilada'));
    renderForm('55');

    fireEvent.click(screen.getByRole('button', { name: /Generar entrada/ }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByLabelText(/Entrada \(JSON\)/)).toHaveValue('{}');
  });
});
