import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../api/http-client';
import { snapshotToEditableGraph } from '../../graph/graph.adapter';
import { CalculatedFieldCallsPanel } from './CalculatedFieldCallsPanel';
import type { UnknownRecord } from '../../utils/records';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

/**
 * Invocar un campo calculado desde un nodo (§5.1). Lo que se fija aquí es que el editor
 * produzca exactamente el enlace que el backend valida: versión fijada, una entrada por
 * cada una del contrato y un destino explícito.
 */
const CATALOG = {
  items: [
    { id: '10', fieldCode: 'debt_to_income', name: 'DTI', status: 'PUBLISHED' },
    { id: '11', fieldCode: 'borrador', name: 'Borrador', status: 'DRAFT' },
  ],
};

const DETAIL = {
  versions: [
    {
      id: '900',
      versionNumber: 3,
      status: 'PUBLISHED',
      inputs: [
        { id: 'deuda_mensual', dataType: 'DECIMAL', required: true },
        { id: 'ingreso_mensual', dataType: 'DECIMAL', required: true },
      ],
    },
    { id: '899', versionNumber: 2, status: 'DEPRECATED', inputs: [] },
  ],
};

function renderPanel(onChange: (calls: UnknownRecord[]) => void, calls: UnknownRecord[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CalculatedFieldCallsPanel
        calls={calls}
        inputs={[{ code: 'deuda_mensual' }, { code: 'ingreso_mensual' }]}
        intermediates={[{ code: 'dti' }]}
        outputs={[{ code: 'dti_publicado' }]}
        onChange={onChange}
      />
    </QueryClientProvider>,
  );
}

describe('CalculatedFieldCallsPanel', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path.startsWith('/v1/calculated-fields?')) return CATALOG as never;
      if (path.startsWith('/v1/calculated-fields/')) return DETAIL as never;
      throw new Error(`ruta no esperada: ${path}`);
    });
  });

  it('solo ofrece campos aprobados o publicados', async () => {
    renderPanel(vi.fn());
    await screen.findByRole('option', { name: /debt_to_income/ });
    // Un borrador puede cambiar bajo los pies del artefacto: no debe poder invocarse.
    expect(screen.queryByRole('option', { name: /borrador/ })).not.toBeInTheDocument();
  });

  it('crea la llamada con la versión fijada y una entrada por cada una del contrato', async () => {
    const onChange = vi.fn();
    renderPanel(onChange);
    await screen.findByRole('option', { name: /debt_to_income/ });

    fireEvent.change(screen.getByLabelText('Campo calculado a invocar'), {
      target: { value: '10' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Invocar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Invocar' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        callKey: 'debt_to_income',
        calculatedFieldVersionId: '900',
        versionNumber: 3,
        targetKind: 'INTERMEDIATE',
        targetCode: 'dti',
        inputMapping: {
          deuda_mensual: { source: 'VARIABLE', path: '' },
          ingreso_mensual: { source: 'VARIABLE', path: '' },
        },
      }),
    ]);
  });

  it('avisa cuando no hay ningún campo aprobado que invocar', async () => {
    mockedApiRequest.mockImplementation(async () => ({ items: [] }) as never);
    renderPanel(vi.fn());
    expect(await screen.findByText(/No hay campos calculados aprobados/)).toBeInTheDocument();
  });

  it('deja elegir el origen de cada entrada y lo guarda en el mapeo', async () => {
    const onChange = vi.fn();
    renderPanel(onChange, [
      {
        callKey: 'debt_to_income',
        fieldCode: 'debt_to_income',
        calculatedFieldVersionId: '900',
        versionNumber: 3,
        inputMapping: { deuda_mensual: { source: 'VARIABLE', path: '' } },
        targetKind: 'INTERMEDIATE',
        targetCode: 'dti',
        contractInputs: [{ id: 'deuda_mensual', dataType: 'DECIMAL', required: true }],
      },
    ]);

    fireEvent.change(await screen.findByLabelText('Variable que alimenta deuda_mensual'), {
      target: { value: 'deuda_mensual' },
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        inputMapping: { deuda_mensual: { source: 'VARIABLE', path: 'deuda_mensual' } },
      }),
    ]);
  });
});

describe('adaptador del grafo', () => {
  it('envía la llamada sin la definición ejecutable', () => {
    // El backend resuelve la definición desde su propio registro. Mandarla desde el
    // cliente sería una vía para meter código en el sandbox saltándose la aprobación.
    const payload = snapshotToEditableGraph({
      variables: [],
      conditions: [],
      actions: [],
      edges: [],
      nodes: [
        {
          key: 'CALCULAR',
          type: 'EXPRESSION',
          label: 'Calcular',
          config: {},
          x: 0,
          y: 0,
          order: 1,
          terminal: false,
          conditions: [],
          actions: [],
          calculatedFieldCalls: [
            {
              callKey: 'dti',
              calculatedFieldVersionId: '900',
              fieldCode: 'debt_to_income',
              versionNumber: 3,
              inputMapping: { deuda: { source: 'VARIABLE', path: 'deuda_mensual' } },
              targetKind: 'INTERMEDIATE',
              targetCode: 'dti',
              contractInputs: [{ id: 'deuda' }],
            },
          ],
        },
      ],
    });

    const [node] = payload.nodes as Array<Record<string, unknown>>;
    const [call] = node.calculatedFieldCalls as Array<Record<string, unknown>>;
    expect(call).toEqual({
      callKey: 'dti',
      calculatedFieldVersionId: '900',
      inputMapping: { deuda: { source: 'VARIABLE', path: 'deuda_mensual' } },
      targetKind: 'INTERMEDIATE',
      targetCode: 'dti',
    });
    expect(call).not.toHaveProperty('definition');
    expect(call).not.toHaveProperty('contractInputs');
  });
});
