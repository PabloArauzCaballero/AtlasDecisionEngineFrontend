import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../api/http-client';
import { CalculatedFieldCreateWizard } from './CalculatedFieldCreateWizard';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

/**
 * El alta tiene que dejar el campo LISTO, no a medias.
 *
 * Antes sólo guardaba los metadatos y la implementación (la fórmula o el código)
 * había que añadirla en otra pantalla, un segundo paso que nadie encontraba. Lo
 * que se prueba aquí es que un único flujo cree el campo y su versión 1.
 */
/**
 * El paso 2 consulta además el catálogo de operaciones autorizadas, así que los
 * mocks se despachan por ruta y no por orden de llamada: encadenarlos hacía que
 * esa consulta se comiera la respuesta destinada al alta.
 */
function routeMock(onVersion: () => unknown) {
  mockedApiRequest.mockReset();
  mockedApiRequest.mockImplementation((path: string) => {
    if (path.includes('/operations')) return Promise.resolve({ operations: [] });
    if (path.endsWith('/versions')) return Promise.resolve(onVersion());
    return Promise.resolve({ id: '77', fieldCode: 'ingreso_disponible' });
  });
}

/** Sólo las llamadas de escritura, ignorando la consulta del catálogo. */
function postCalls() {
  return mockedApiRequest.mock.calls.filter(
    ([, init]) => (init as { method?: string } | undefined)?.method === 'POST',
  );
}

function renderWizard(onCreated = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CalculatedFieldCreateWizard onCancel={vi.fn()} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return onCreated;
}

function fillMetadata() {
  fireEvent.change(screen.getByLabelText('Código técnico'), {
    target: { value: 'ingreso_disponible' },
  });
  fireEvent.change(screen.getByLabelText('Nombre visible'), {
    target: { value: 'Ingreso disponible' },
  });
  fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'AFORDABILIDAD' } });
  fireEvent.change(screen.getByLabelText('Equipo responsable'), { target: { value: 'RIESGOS' } });
  fireEvent.change(screen.getByLabelText('Descripción'), {
    target: { value: 'Ingreso menos gastos' },
  });
  fireEvent.change(
    screen.getByLabelText('Justificación funcional: ¿por qué existe este cálculo?'),
    { target: { value: 'Base de la capacidad de pago' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente: qué calcula' }));
}

describe('alta de campo calculado', () => {
  it('el primer paso pide identidad y el segundo la implementación', () => {
    renderWizard();
    // Paso 1: no debe verse aún la modalidad de implementación.
    expect(screen.queryByText('Modalidad de implementación')).not.toBeInTheDocument();

    fillMetadata();

    // Paso 2: ahí sí, con las tres modalidades disponibles.
    expect(screen.getByText('Modalidad de implementación')).toBeInTheDocument();
    expect(screen.getByLabelText('Constructor visual')).toBeInTheDocument();
    expect(screen.getByLabelText('Expresión JavaScript')).toBeInTheDocument();
    expect(screen.getByLabelText('Expresión Python')).toBeInTheDocument();
  });

  it('crea el campo y su versión 1 en el mismo flujo', async () => {
    routeMock(() => ({ versionNumber: 1 }));
    const onCreated = renderWizard();

    fillMetadata();
    fireEvent.click(screen.getByRole('button', { name: 'Crear campo calculado' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const writes = postCalls();
    expect(writes).toHaveLength(2);

    const [fieldPath, fieldInit] = writes[0]!;
    expect(fieldPath).toBe('/v1/calculated-fields');
    expect(fieldInit).toMatchObject({
      body: expect.objectContaining({ fieldCode: 'ingreso_disponible' }),
    });

    // La versión cuelga del id que devolvió la primera llamada.
    const [versionPath, versionInit] = writes[1]!;
    expect(versionPath).toBe('/v1/calculated-fields/77/versions');
    expect(versionInit).toMatchObject({
      body: expect.objectContaining({ implementationKind: 'OPERATION' }),
    });
  });

  it('muestra cada incumplimiento del contrato que devuelve el motor', async () => {
    routeMock(() => {
      throw {
        details: { issues: [{ code: 'RETURN_CONTRACT_MISSING', message: 'Falta el contrato' }] },
      };
    });
    renderWizard();

    fillMetadata();
    fireEvent.click(screen.getByRole('button', { name: 'Crear campo calculado' }));

    expect(await screen.findByText('RETURN_CONTRACT_MISSING')).toBeInTheDocument();
    expect(screen.getByText('Falta el contrato')).toBeInTheDocument();
  });
});
