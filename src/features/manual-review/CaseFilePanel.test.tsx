import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { apiRequest } from '../../api/http-client';
import type { IdentityUser } from '../../auth/auth.types';
import { CaseFilePanel } from './CaseFilePanel';

/**
 * El expediente enseña los datos del solicitante, así que es la superficie con
 * más que perder de todo el portal.
 *
 * Estas pruebas fijan dos cosas que estaban rotas de formas distintas:
 *
 * 1. `canConsultCaseFile` existía, estaba documentado y tenía prueba unitaria en
 *    verde desde el principio, pero NADIE lo llamaba: el panel se pintaba a
 *    cualquiera que pudiera abrir el caso. Una prueba del helper aislado no
 *    detecta eso; ésta pide el panel entero con un rol que no debe verlo.
 * 2. El enmascarado por clasificación se aplicaba en UNA tabla de la traza, y
 *    este panel —el que se titula «Datos del solicitante»— pintaba el valor en
 *    claro.
 */

let currentUser: IdentityUser | null = null;

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: currentUser }),
  // El doble reproduce la union real (roles + legacyRoles): un mock que
  // devolviera sólo `roles` volvería a esconder justo el fallo que
  // `effectiveRoles` existe para evitar.
  useEffectiveRoles: () => [...(currentUser?.roles ?? []), ...(currentUser?.legacyRoles ?? [])],
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedApiRequest = vi.mocked(apiRequest);

function userWith(roles: string[]): IdentityUser {
  return {
    id: '9',
    tenantId: '1',
    email: 'analista@atlas.bo',
    fullName: 'Persona Analista',
    name: 'Persona',
    userCode: 'AN-9',
    status: 'ACTIVE',
    department: null,
    jobTitle: null,
    mustChangePassword: false,
    mfaEnabled: false,
    roles,
    legacyRoles: [],
    permissions: [],
  };
}

const EXECUTION = {
  requestId: 'REQ-7781',
  artifactCode: 'SCORING_CREDITO',
  outcome: 'REJECTED',
  variables: [
    { variableCode: 'CI_NUMBER', valueJson: '9876543', sensitivityClass: 'PII' },
    { variableCode: 'MONTHLY_INCOME', valueJson: '12000', sensitivityClass: 'INTERNAL' },
  ],
  reasonCodes: [{ reasonCode: 'INCOME_TOO_LOW', publicMessage: 'Ingresos insuficientes' }],
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CaseFilePanel executionId="4120" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedApiRequest.mockReset();
  mockedApiRequest.mockResolvedValue(EXECUTION);
});

describe('CaseFilePanel', () => {
  it('no pide ni pinta el expediente a quien no puede consultarlo', async () => {
    currentUser = userWith(['AUDITOR']);
    renderPanel();

    expect(await screen.findByText(/requiere rol Risk Analyst/i)).toBeInTheDocument();
    // Por el encabezado y no por el texto: el propio mensaje de permiso nombra
    // «datos del solicitante» al explicar lo que NO se está enseñando.
    expect(
      screen.queryByRole('heading', { name: 'Datos del solicitante' }),
    ).not.toBeInTheDocument();
    // No basta con no pintarlo: pedirlo ya sería traer a la memoria del
    // navegador un dato que esta persona no debe ver.
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it.each([['RISK_ANALYST'], ['FRAUD_ANALYST'], ['OPERATIONS']])(
    'lo muestra al rol %s',
    async (role) => {
      currentUser = userWith([role]);
      renderPanel();
      expect(
        await screen.findByRole('heading', { name: 'Datos del solicitante' }),
      ).toBeInTheDocument();
    },
  );

  it('enmascara el valor clasificado como personal y deja ver el resto', async () => {
    currentUser = userWith(['RISK_ANALYST']);
    renderPanel();

    // Se espera a un dato de la RESPUESTA, no al encabezado: el panel se pinta
    // también mientras la consulta está en curso, y con la tabla vacía todas
    // las aserciones de abajo pasarían sin haber mirado nada.
    await screen.findByText('CI_NUMBER');
    expect(screen.queryByText('9876543')).not.toBeInTheDocument();
    expect(screen.getAllByText('•••').length).toBeGreaterThan(0);
    // El dato no sensible se sigue viendo: enmascarar de más deja el expediente
    // inservible para valorar el caso, que es para lo que se abre.
    expect(screen.getByText('12000')).toBeInTheDocument();
  });

  it('dice que no hay motivos en vez de esconder el panel', async () => {
    currentUser = userWith(['RISK_ANALYST']);
    mockedApiRequest.mockResolvedValue({ ...EXECUTION, reasonCodes: [] });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/no publicó ningún motivo/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Motivos de la decisión')).toBeInTheDocument();
  });
});
