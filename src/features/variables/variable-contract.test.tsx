import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../api/http-client';
import { VariableContractEditor } from './VariableContractEditor';
import { emptyContractDraft, toPayload } from './variable-contract.draft';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

/**
 * §1.2 exige poder validar el contrato ANTES de guardarlo y saber si el cambio rompe a
 * quien ya usa la variable. Una versión de variable es inmutable en cuanto un artefacto
 * la usa, así que estas dos señales son la diferencia entre corregir y convivir con el
 * error para siempre.
 */
function renderEditor(definitionId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const draft = {
    ...emptyContractDraft(),
    displayName: 'Ingreso mensual',
    constraints: { min: 0, max: 100 },
    exampleValid: '50',
    exampleInvalid: '500',
  };
  return render(
    <QueryClientProvider client={client}>
      <VariableContractEditor definitionId={definitionId} draft={draft} onChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('toPayload', () => {
  it('interpreta los ejemplos escritos según su forma', () => {
    const payload = toPayload({
      ...emptyContractDraft(),
      exampleValid: '42',
      exampleInvalid: 'texto',
    });
    expect(payload.exampleValid).toBe(42);
    expect(payload.exampleInvalid).toBe('texto');
  });

  it('omite los campos vacíos en vez de mandar cadenas en blanco', () => {
    const payload = toPayload(emptyContractDraft());
    expect(payload.exampleValid).toBeUndefined();
    expect(payload.validationMessage).toBeUndefined();
    expect(payload.displayName).toBeUndefined();
  });
});

describe('VariableContractEditor', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('muestra los incumplimientos que devuelve el servidor', async () => {
    mockedApiRequest.mockResolvedValue({
      valid: false,
      issues: [{ code: 'RANGE_INVERTED', message: 'Rango: el mínimo supera al máximo' }],
      samples: [],
    } as never);

    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Validar contrato/ }));

    expect(await screen.findByText(/el mínimo supera al máximo/)).toBeInTheDocument();
  });

  it('confirma cuando el contrato es coherente', async () => {
    mockedApiRequest.mockResolvedValue({ valid: true, issues: [], samples: [] } as never);

    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Validar contrato/ }));

    expect(await screen.findByText('El contrato es coherente.')).toBeInTheDocument();
  });

  it('avisa de un cambio incompatible sobre una variable existente', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/v1/variables/validate-contract') {
        return { valid: true, issues: [], samples: [] } as never;
      }
      return {
        level: 'BREAKING',
        changes: [{ level: 'BREAKING', code: 'MIN_TIGHTENED', message: 'min pasa de 0 a 100' }],
      } as never;
    });

    renderEditor('42');
    fireEvent.click(screen.getByRole('button', { name: /Validar contrato/ }));

    expect(await screen.findByText(/datos hoy válidos dejarían de serlo/)).toBeInTheDocument();
    expect(screen.getByText(/min pasa de 0 a 100/)).toBeInTheDocument();
  });

  it('no pregunta por compatibilidad cuando la variable aún no existe', async () => {
    mockedApiRequest.mockResolvedValue({ valid: true, issues: [], samples: [] } as never);

    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Validar contrato/ }));

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledTimes(1));
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/v1/variables/validate-contract',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
