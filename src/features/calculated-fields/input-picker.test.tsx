import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../api/http-client';
import { CalculatedFieldInputsForm } from './CalculatedFieldInputsForm';
import type { CalculatedFieldInput } from './calculated-field.types';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

const PICKER = [
  {
    definitionId: '3000',
    variableCode: 'monthly_income',
    canonicalName: 'Ingreso mensual',
    dataType: 'DECIMAL',
    nullable: false,
    latestVersionId: '3001',
  },
  {
    definitionId: '3010',
    variableCode: 'bureau_score',
    canonicalName: 'Score de buró',
    dataType: 'INTEGER',
    nullable: true,
    latestVersionId: '3011',
  },
];

/**
 * Una entrada de un campo calculado casi siempre ES una variable del catálogo.
 *
 * Escribir su identificador a mano obligaba a acertar de memoria el código exacto y a
 * repetir tipo y restricciones; un dedazo no daba error, daba una entrada que ningún
 * artefacto sabría rellenar.
 */
function renderForm(initial: CalculatedFieldInput[] = []) {
  mockedApiRequest.mockReset();
  mockedApiRequest.mockImplementation((path: string) => {
    if (path.startsWith('/v1/views/pickers/variables')) return Promise.resolve(PICKER);
    if (path.startsWith('/v1/variables/3000')) {
      return Promise.resolve({ versions: [{ constraintsJson: { min: 0, max: 50000 } }] });
    }
    return Promise.resolve({});
  });
  const onChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CalculatedFieldInputsForm inputs={initial} onChange={onChange} />
    </QueryClientProvider>,
  );
  return onChange;
}

describe('entradas de un campo calculado', () => {
  it('ofrece las variables del catálogo en un select, con su código y su tipo', async () => {
    renderForm();
    const select = await screen.findByLabelText('Variable del catálogo');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /monthly_income/ })).toBeInTheDocument(),
    );
    expect(select).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /bureau_score · Score de buró \(INTEGER\)/ }),
    ).toBeInTheDocument();
  });

  it('al elegir una variable copia identificador, nombre, tipo y obligatoriedad', async () => {
    const onChange = renderForm();
    const select = await screen.findByLabelText('Variable del catálogo');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /monthly_income/ })).toBeInTheDocument(),
    );

    fireEvent.change(select, { target: { value: '3000' } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        id: 'monthly_income',
        name: 'Ingreso mensual',
        dataType: 'DECIMAL',
        required: true,
      }),
    ]);
  });

  it('trae también las restricciones, que son lo que hace útil generar datos de prueba', async () => {
    renderForm();
    const select = await screen.findByLabelText('Variable del catálogo');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /monthly_income/ })).toBeInTheDocument(),
    );

    fireEvent.change(select, { target: { value: '3000' } });

    // Llegan en una segunda petición: el picker no las trae, viven en el detalle.
    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledWith('/v1/variables/3000'));
  });

  it('sigue permitiendo declarar una entrada propia que no es del catálogo', async () => {
    const onChange = renderForm();
    fireEvent.click(await screen.findByLabelText('Entrada propia'));

    fireEvent.change(screen.getByLabelText('Identificador de la nueva entrada'), {
      target: { value: 'factor_conversion' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Añadir entrada/ }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'factor_conversion', dataType: 'DECIMAL' }),
    ]);
  });

  it('no ofrece una variable que ya está declarada como entrada', async () => {
    renderForm([
      {
        id: 'monthly_income',
        name: 'Ingreso mensual',
        description: '',
        dataType: 'DECIMAL',
        required: true,
      },
    ]);
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /bureau_score/ })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('option', { name: /monthly_income/ })).not.toBeInTheDocument();
  });
});
