import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { IdentityUser } from '../auth/auth.types';
import { ResourceListPage } from './ResourceListPage';
import type { ResourceConfig } from '../resources/resource.types';

let currentUser: IdentityUser | null = null;

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: currentUser }),
  // El doble reproduce la union real (roles + legacyRoles): un mock que
  // devolviera sólo `roles` volvería a esconder justo el fallo que
  // `effectiveRoles` existe para evitar.
  useEffectiveRoles: () => [...(currentUser?.roles ?? []), ...(currentUser?.legacyRoles ?? [])],
}));
// Función simple, no `vi.fn().mockResolvedValue(...)`: la configuración del
// proyecto limpia los mocks entre pruebas y la implementación se perdería,
// dejando la consulta devolviendo `undefined`.
vi.mock('../resources/resource.api', () => ({
  listResource: () =>
    Promise.resolve({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
    }),
}));

const config: ResourceConfig = {
  key: 'artifacts',
  eyebrow: '',
  title: 'Inventario',
  description: '',
  endpoint: '/v1/artifacts',
  columns: [],
  primaryAction: 'Nuevo Artefacto',
  createFields: [{ key: 'artifactCode', label: 'Código', required: true }],
  createRoles: ['PLATFORM_ADMIN'],
  createDeniedHint: 'Sólo un Platform Admin crea artefactos.',
};

function userWith(roles: string[]): IdentityUser {
  return { id: '1', roles, legacyRoles: [] } as unknown as IdentityUser;
}

function renderWith(roles: string[]) {
  currentUser = userWith(roles);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ResourceListPage config={config} />
    </QueryClientProvider>,
  );
}

describe('alta restringida en un listado de recursos', () => {
  it('deja crear al administrador', async () => {
    renderWith(['PLATFORM_ADMIN']);
    expect(await screen.findByRole('button', { name: /Nuevo Artefacto/ })).toBeEnabled();
  });

  it('apaga el alta a quien sólo consulta, y explica por qué en vez de callarse', async () => {
    renderWith(['RISK_ANALYST']);
    const button = await screen.findByRole('button', { name: /Nuevo Artefacto/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Sólo un Platform Admin crea artefactos.');
  });

  it('tampoco se lo permite al tester: proponer una versión no es crear el artefacto', async () => {
    renderWith(['QA_ANALYST']);
    expect(await screen.findByRole('button', { name: /Nuevo Artefacto/ })).toBeDisabled();
  });
});
