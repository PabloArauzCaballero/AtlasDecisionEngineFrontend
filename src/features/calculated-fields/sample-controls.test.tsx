import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../api/http-client';
import { CalculatedFieldSampleControls } from './CalculatedFieldSampleControls';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

/**
 * Generar datos de prueba tiene que ser configurable, y reproducible.
 *
 * Antes eran tres botones que pedían UN caso de cada clase, sin número ni semilla: un caso
 * no basta para creerse nada, y sin semilla lo que acababa de fallar no se podía volver a
 * producir. El motor devuelve la semilla justamente para eso, y el portal la tiraba.
 */
function renderControls(response: unknown, onLoad = vi.fn()) {
  mockedApiRequest.mockReset();
  mockedApiRequest.mockResolvedValue(response as never);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CalculatedFieldSampleControls
        target={{ kind: 'VERSION', versionId: '6101' }}
        blocked={null}
        onLoad={onLoad}
      />
    </QueryClientProvider>,
  );
  return onLoad;
}

const BATCH = {
  seed: 'semilla-devuelta',
  kind: 'BOUNDARY',
  cases: [
    { index: 0, kind: 'BOUNDARY', mutation: 'AT_MIN', input: { deuda: 0 } },
    { index: 1, kind: 'BOUNDARY', mutation: 'AT_MAX', input: { deuda: 10000 } },
  ],
};

describe('generación de datos de prueba', () => {
  it('manda la clase, el número de casos y la semilla que se pidieron', async () => {
    renderControls(BATCH);

    fireEvent.change(screen.getByLabelText('Datos de prueba'), { target: { value: 'BOUNDARY' } });
    fireEvent.change(screen.getByLabelText('Casos'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Semilla'), { target: { value: 'mi-semilla' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar/ }));

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalled());
    const [path, init] = mockedApiRequest.mock.calls[0]!;
    expect(path).toBe('/v1/calculated-fields/versions/6101/sample-inputs');
    expect(init).toMatchObject({
      method: 'POST',
      body: { kind: 'BOUNDARY', count: 7, seed: 'mi-semilla' },
    });
  });

  it('carga el primer caso en el formulario y deja elegir los demás', async () => {
    const onLoad = renderControls(BATCH);
    fireEvent.click(screen.getByRole('button', { name: /Generar/ }));

    await waitFor(() => expect(onLoad).toHaveBeenCalledWith({ deuda: 0 }));
    fireEvent.click(await screen.findByRole('button', { name: /Caso 2 · AT_MAX/ }));
    expect(onLoad).toHaveBeenLastCalledWith({ deuda: 10000 });
  });

  it('devuelve la semilla al formulario, que es lo que hace repetible la tanda', async () => {
    renderControls(BATCH);
    fireEvent.click(screen.getByRole('button', { name: /Generar/ }));

    await waitFor(() => expect(screen.getByLabelText('Semilla')).toHaveValue('semilla-devuelta'));
  });

  it('respeta el tope de casos de cada clase', () => {
    renderControls(BATCH);
    fireEvent.change(screen.getByLabelText('Casos'), { target: { value: '99' } });
    expect(screen.getByLabelText('Casos')).toHaveValue(20);

    fireEvent.change(screen.getByLabelText('Datos de prueba'), { target: { value: 'OUTCOMES' } });
    fireEvent.change(screen.getByLabelText('Casos por clase'), { target: { value: '99' } });
    expect(screen.getByLabelText('Casos por clase')).toHaveValue(10);
  });

  it('avisa de las entradas cuyo contrato no admite ningún valor válido', async () => {
    renderControls({
      ...BATCH,
      cases: [{ ...BATCH.cases[0], unsatisfiable: ['deuda'] }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Generar/ }));

    expect(await screen.findByText(/no admiten NINGÚN valor válido/)).toBeInTheDocument();
  });
});

describe('tipos de salida', () => {
  const REPORT = {
    seed: 'cobertura',
    countPerKind: 3,
    total: 9,
    declared: [
      {
        code: 'VALID',
        label: 'Valor válido',
        reason: 'termina dentro del contrato',
        covered: true,
      },
      {
        code: 'DEFAULTED',
        label: 'Valor por defecto',
        reason: 'la política ante datos que faltan devuelve el valor por defecto',
        covered: false,
        unreachable: 'no hay ningún valor por defecto declarado',
      },
      {
        code: 'ERROR:CALCULATION_FAILED',
        label: 'Falla con CALCULATION_FAILED',
        reason: 'la política ante división entre cero es fallar',
        covered: false,
      },
    ],
    undeclared: ['ERROR:CALCULATED_FIELD_INPUT_INVALID'],
    uncovered: ['DEFAULTED', 'ERROR:CALCULATION_FAILED'],
    cases: [
      { index: 0, kind: 'VALID', input: { deuda: 1 }, outcome: 'VALID', value: 1, durationMs: 2 },
    ],
  };

  it('pide la cobertura por su propio camino y enseña lo que NO se alcanzó', async () => {
    renderControls(REPORT);
    fireEvent.change(screen.getByLabelText('Datos de prueba'), { target: { value: 'OUTCOMES' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar/ }));

    await waitFor(() =>
      expect(mockedApiRequest.mock.calls[0]![0]).toBe(
        '/v1/calculated-fields/versions/6101/outcomes',
      ),
    );
    expect(await screen.findByText('Falla con CALCULATION_FAILED')).toBeInTheDocument();
    expect(screen.getByText(/Ningún caso de esta tanda lo alcanzó/)).toBeInTheDocument();
  });

  it('distingue «no se alcanzó» de «no puede alcanzarse nunca»', async () => {
    renderControls(REPORT);
    fireEvent.change(screen.getByLabelText('Datos de prueba'), { target: { value: 'OUTCOMES' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar/ }));

    expect(
      await screen.findByText(/El contrato lo declara pero el motor no puede producirlo/),
    ).toBeInTheDocument();
  });
});
