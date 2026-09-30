import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { ApiError } from '../api/ApiError';
import { AuthProvider } from './AuthProvider';
import * as authApi from './auth.api';
import type { SessionPayload } from './auth.types';
import { useAuth } from './useAuth';

/**
 * Al abrir o recargar, un motor que NO CONTESTA no es un motor que rechaza la sesión.
 *
 * Durante un despliegue el proxy devuelve 503/502 y, antes, eso mandaba a la entrada a quien
 * tenía la sesión viva (barrido de TEST, 2026-09-29: siete pantallas seguidas en «Bienvenido
 * nuevamente»). Ahora se queda en `unavailable` y se puede reintentar sin volver a entrar.
 */
const session: SessionPayload = {
  accessToken: 'token',
  tokenType: 'Bearer',
  expiresIn: '900',
  user: {
    id: '1',
    tenantId: '1',
    email: 'ana@atlas.test',
    fullName: 'Ana',
    name: 'Ana',
    userCode: null,
    status: 'ACTIVE',
    department: null,
    jobTitle: null,
    mustChangePassword: false,
    mfaEnabled: false,
    roles: ['PLATFORM_ADMIN'],
    legacyRoles: [],
    permissions: [],
  },
};

function Estado() {
  const { status, retrySession } = useAuth();
  return (
    <>
      <p>{status}</p>
      <button type="button" onClick={retrySession}>
        reintentar
      </button>
    </>
  );
}

function montar() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Estado />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('recuperar la sesión al abrir la página', () => {
  it('si el motor no contesta, no se cierra la sesión: queda «no disponible»', async () => {
    vi.spyOn(authApi, 'restoreSession').mockRejectedValue(
      new ApiError('Service Unavailable', 503, 'DECISION_ENGINE_UNAVAILABLE'),
    );
    montar();
    await waitFor(() => expect(screen.getByText('unavailable')).toBeInTheDocument());
  });

  it('reintentar recupera la sesión cuando el motor vuelve', async () => {
    const restore = vi
      .spyOn(authApi, 'restoreSession')
      .mockRejectedValueOnce(new ApiError('Bad Gateway', 502))
      .mockResolvedValueOnce(session);
    montar();
    await waitFor(() => expect(screen.getByText('unavailable')).toBeInTheDocument());
    await act(async () => screen.getByRole('button', { name: 'reintentar' }).click());
    await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument());
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it('si el motor RECHAZA la sesión, sí se cierra', async () => {
    vi.spyOn(authApi, 'restoreSession').mockRejectedValue(new ApiError('Unauthorized', 401));
    montar();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeInTheDocument());
  });
});
