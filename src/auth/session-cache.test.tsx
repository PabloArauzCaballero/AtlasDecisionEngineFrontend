import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { AuthProvider } from './AuthProvider';
import * as authApi from './auth.api';
import type { IdentityUser, SessionPayload } from './auth.types';
import { useAuth } from './useAuth';

/**
 * La caché no puede sobrevivir al cambio de manos de la sesión.
 *
 * `QueryProvider` construye el cliente una vez por pestaña y el layout raíz no se
 * desmonta al navegar, así que cerrar sesión —que es `router.replace('/login')`,
 * una navegación de cliente— dejaba en memoria todo lo que había respondido el
 * motor. Como ninguna `queryKey` del portal lleva tenant ni usuario, la siguiente
 * persona que entraba en esa misma pestaña veía los datos de la anterior.
 *
 * Esta prueba monta una consulta cualquiera, cierra sesión y comprueba que el
 * dato ya no está en la caché. Sin `queryClient.clear()` en `expireSession`,
 * falla: la lectura devuelve el expediente del usuario que se fue.
 */

function userFixture(id: string, tenantId = '1'): IdentityUser {
  return {
    id,
    tenantId,
    email: `${id}@atlas.test`,
    fullName: id,
    name: id,
    userCode: null,
    status: 'ACTIVE',
    department: null,
    jobTitle: null,
    mustChangePassword: false,
    mfaEnabled: false,
    roles: ['PLATFORM_ADMIN'],
    legacyRoles: [],
    permissions: [],
  };
}

function sessionFixture(id: string, tenantId = '1'): SessionPayload {
  return {
    accessToken: `token-for-${id}`,
    tokenType: 'Bearer',
    expiresIn: '900',
    user: userFixture(id, tenantId),
  };
}

const CASE_KEY = ['resource', 'manual-reviews'];

function CaseFile() {
  const { data } = useQuery({
    queryKey: CASE_KEY,
    queryFn: () => Promise.resolve('Expediente de Ana — ingreso 12.400'),
  });
  return <p>{data ?? 'sin datos'}</p>;
}

let session: { current: ReturnType<typeof useAuth> | null };

function Probe() {
  session.current = useAuth();
  return null;
}

function mount(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
        <CaseFile />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  session = { current: null };
  vi.spyOn(authApi, 'restoreSession').mockResolvedValue(sessionFixture('ana'));
  vi.spyOn(authApi, 'logout').mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('la caché no sobrevive al cambio de sesión', () => {
  it('se vacía al cerrar sesión, no espera al recolector', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mount(client);

    await screen.findByText(/Expediente de Ana/);
    expect(client.getQueryData(CASE_KEY)).toContain('Ana');

    await act(async () => {
      await session.current?.logout();
    });

    expect(vi.mocked(authApi.logout)).toHaveBeenCalled();
    expect(client.getQueryData(CASE_KEY)).toBeUndefined();
  });

  it('se vacía cuando entra otra identidad sin cierre previo', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(authApi, 'login').mockResolvedValue(sessionFixture('bruno'));
    mount(client);

    await screen.findByText(/Expediente de Ana/);
    expect(client.getQueryData(CASE_KEY)).toContain('Ana');

    await act(async () => {
      await session.current?.login({ tenantId: '1', email: 'bruno@atlas.test', password: 'x' });
    });

    expect(client.getQueryData(CASE_KEY)).toBeUndefined();
  });

  it('renovar el token NO tira el trabajo en curso: es la misma sesión', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(authApi, 'refresh').mockResolvedValue(sessionFixture('ana'));
    mount(client);

    await screen.findByText(/Expediente de Ana/);

    await act(async () => {
      await session.current?.refreshAccessToken();
    });

    await waitFor(() => expect(client.getQueryData(CASE_KEY)).toContain('Ana'));
  });
});
