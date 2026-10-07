import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { apiRequest } from '../api/http-client';
import { CreateTestSuiteForm } from './CreateTestSuiteForm';
import { expectationGap } from './expected-result';

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CreateTestSuiteForm versionId="5" onCreated={vi.fn()} onCancel={vi.fn()} />
    </QueryClientProvider>,
  );
}

function expectedTextarea() {
  const editor = document.querySelector('[data-editor="new-suite-expected"]') as HTMLElement;
  fireEvent.click(within(editor).getByRole('tab', { name: 'JSON' }));
  return editor.querySelector('textarea') as HTMLTextAreaElement;
}

describe('Resultado esperado de un caso', () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it('`{}` no afirma nada; un desenlace sí; un JSON roto se dice', () => {
    expect(expectationGap('{}')).toContain('pasa siempre');
    expect(expectationGap('{"outcome":"APPROVED"}')).toBeNull();
    expect(expectationGap('{')).toContain('no es un objeto JSON');
    expect(expectationGap('[]')).toContain('no es un objeto JSON');
  });

  it('no deja crear una suite cuyo primer caso no espera nada, y explica qué poner', async () => {
    // Así nacieron las cinco suites vacías de TEST: «Caso inicial» con `{}` de fábrica.
    mockedApiRequest.mockResolvedValue({} as never);
    renderForm();
    const crear = screen.getByRole('button', { name: 'Crear suite' });

    expect(crear).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('{"outcome": "APPROVED"}');
    expect(screen.getByRole('alert')).toHaveTextContent('Generar pruebas automáticas');

    fireEvent.change(expectedTextarea(), { target: { value: '{"outcome":"DECLINED"}' } });

    await waitFor(() => expect(crear).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
