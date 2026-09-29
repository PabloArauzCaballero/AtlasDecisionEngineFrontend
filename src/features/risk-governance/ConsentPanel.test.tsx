import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../api/http-client';
import { ConsentPanel, CONSENT_SOURCE_NOTICE } from './ConsentPanel';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));

const mockedApiRequest = vi.mocked(apiRequest);

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConsentPanel />
    </QueryClientProvider>,
  );
}

async function consult(reference: string) {
  fireEvent.change(screen.getByLabelText(/Referencia del titular/), {
    target: { value: reference },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar permisos' }));
}

/**
 * Los consentimientos se registran y revocan en Atlas Core; el motor sólo los consulta.
 * La pantalla era el segundo sitio donde cambiaba la licitud, y el motor ya rechaza esas
 * escrituras desde una sesión de persona.
 */
describe('ConsentPanel · sólo lectura', () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it('dice dónde se registran y revocan, y no ofrece ninguna escritura', () => {
    renderPanel();
    expect(screen.getByTestId('consent-source-notice')).toHaveTextContent(CONSENT_SOURCE_NOTICE);
    expect(CONSENT_SOURCE_NOTICE).toContain('Atlas Core');
    expect(screen.queryByRole('button', { name: /Registrar permiso/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Registrar un permiso')).not.toBeInTheDocument();
  });

  it('la consulta viaja por POST con la referencia en el cuerpo y pinta cada veredicto sin «Revocar»', async () => {
    mockedApiRequest.mockResolvedValue({
      items: [
        {
          id: '1',
          purpose: 'credit_underwriting',
          basis: 'CREDIT_PROTECTION',
          valid: true,
          reason: 'VALID',
          expiresAt: null,
          daysRemaining: null,
        },
        {
          id: '2',
          purpose: 'credit_bureau_query',
          basis: 'CONSENT',
          valid: false,
          reason: 'REVOKED',
          expiresAt: null,
          daysRemaining: null,
        },
      ],
    });
    renderPanel();
    await consult('sujeto-1');

    await waitFor(() => expect(screen.getByText('credit_bureau_query')).toBeInTheDocument());
    expect(mockedApiRequest).toHaveBeenCalledWith('/v1/risk-governance/consents/lookup', {
      method: 'POST',
      body: { subjectReference: 'sujeto-1', purpose: '-' },
    });
    expect(screen.getByText('Vigente')).toBeInTheDocument();
    expect(screen.getByText('Revocado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revocar' })).not.toBeInTheDocument();
    // Ninguna llamada de escritura salió de la pantalla.
    const paths = mockedApiRequest.mock.calls.map(([path]) => path);
    expect(paths).not.toContain('/v1/risk-governance/consents');
    expect(paths).not.toContain('/v1/risk-governance/consents/revoke');
  });

  it('sin permisos registrados lo dice: la ausencia no es una autorización', async () => {
    mockedApiRequest.mockResolvedValue({ items: [] });
    renderPanel();
    await consult('sujeto-2');
    expect(
      await screen.findByText(/La ausencia de constancia no es una autorización/),
    ).toBeInTheDocument();
  });

  it('si la consulta falla lo dice en vez de quedarse en blanco', async () => {
    mockedApiRequest.mockRejectedValue(new Error('caído'));
    renderPanel();
    await consult('sujeto-3');
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar');
  });
});
