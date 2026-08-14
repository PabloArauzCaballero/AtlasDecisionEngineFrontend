import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ApiError } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import type { IdentityUser } from '../auth/auth.types';
import { ApprovalRequestDetailPage } from './ApprovalRequestDetailPage';

const notify = vi.fn();
let currentUser: IdentityUser | null = null;

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../notifications/useNotifications', () => ({
  useNotifications: () => ({ notify }),
}));
vi.mock('../auth/useAuth', () => ({
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
    id: '7',
    tenantId: '1',
    email: 'aprobador@atlas.bo',
    fullName: 'Persona Aprobadora',
    name: 'Persona',
    userCode: 'APR-7',
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

const REQUEST = {
  id: '31',
  status: 'IN_REVIEW',
  workflowCode: 'STANDARD',
  requestedBy: 'autor@atlas.bo',
  artifactVersion: {
    id: '55',
    versionNumber: '4',
    semanticVersion: '1.4.0',
    checksum: 'abc123',
    artifact: { name: 'Scoring de crédito', artifactCode: 'SCORING_CREDITO' },
  },
  steps: [{ id: '1', stepOrder: 1, requiredRole: 'RISK_APPROVER', status: 'PENDING' }],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ApprovalRequestDetailPage requestId="31" />
    </QueryClientProvider>,
  );
}

describe('ApprovalRequestDetailPage', () => {
  beforeEach(() => {
    notify.mockReset();
    mockedApiRequest.mockReset();
    mockedApiRequest.mockImplementation(async (path) =>
      path.startsWith('/v1/approval-requests/') ? REQUEST : {},
    );
  });

  it('no ofrece firmar a quien no tiene el rol del paso', async () => {
    currentUser = userWith(['AUDITOR']);
    renderPage();

    expect(await screen.findByText(/Este paso requiere el rol RISK_APPROVER/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aprobar Despliegue/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rechazar/ })).not.toBeInTheDocument();
  });

  it('no afirma que los gates pasaron cuando no hay evidencia que lo respalde', async () => {
    currentUser = userWith(['RISK_APPROVER']);
    renderPage();

    expect(await screen.findByText(/no puede afirmar que la compilación/)).toBeInTheDocument();
    expect(screen.queryByText('PASSED')).not.toBeInTheDocument();
  });

  /*
   * El `checksum` de la versión NO es evidencia de compilación: existe también
   * en un borrador que nunca se compiló. La fixture lo trae, así que si algún
   * día alguien lo usa para rellenar la fila, esta prueba lo delata.
   */
  it('no toma el checksum de la versión por una compilación aprobada', async () => {
    currentUser = userWith(['RISK_APPROVER']);
    renderPage();

    await screen.findByText(/no puede afirmar que la compilación/);
    expect(screen.queryByText('Compilación determinista')).not.toBeInTheDocument();
  });

  it('pinta la evidencia real cuando el motor sí la publica', async () => {
    currentUser = userWith(['RISK_APPROVER']);
    mockedApiRequest.mockImplementation(async (path) => {
      if (path.startsWith('/v1/approval-requests/')) return REQUEST;
      if (path.includes('/test-suites')) {
        return {
          items: [
            {
              id: '9',
              suiteCode: 'REGRESION_BLOQUEANTE',
              isBlocking: true,
              cases: [{ id: 'c1' }, { id: 'c2' }],
              runs: [{ id: '77', status: 'PASSED', finishedAt: '2026-08-01T10:00:00Z' }],
            },
          ],
        };
      }
      if (path.startsWith('/v1/artifact-versions/')) {
        return {
          id: '55',
          compiledArtifacts: [{ id: '3', compileStatus: 'SUCCESS', compilerVersion: '2.1.0' }],
        };
      }
      return {};
    });
    renderPage();

    expect(await screen.findByText('REGRESION_BLOQUEANTE')).toBeInTheDocument();
    expect(screen.getByText('Compilación determinista')).toBeInTheDocument();
    expect(screen.queryByText(/no puede afirmar que la compilación/)).not.toBeInTheDocument();
  });

  it('exige confirmación explícita antes de firmar y manda la clave de idempotencia', async () => {
    currentUser = userWith(['RISK_APPROVER']);
    renderPage();

    const comment = await screen.findByRole('textbox');
    fireEvent.change(comment, { target: { value: 'Revisado con el equipo de riesgo.' } });
    fireEvent.click(screen.getByRole('button', { name: /Aprobar Despliegue/ }));

    // El primer clic abre la confirmación; todavía no ha viajado ninguna decisión.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(mockedApiRequest).not.toHaveBeenCalledWith(
      expect.stringContaining('/decisions'),
      expect.anything(),
    );

    fireEvent.click(screen.getByRole('button', { name: /Firmar aprobación/ }));

    await waitFor(() =>
      expect(mockedApiRequest).toHaveBeenCalledWith(
        '/v1/approval-steps/1/decisions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': expect.stringMatching(/^approval-decision-/),
          }),
          body: expect.objectContaining({ decision: 'APPROVE' }),
        }),
      ),
    );
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Decisión registrada: aprobada' }),
      ),
    );
  });

  it('compara el grafo contra su origen y nombra cada cambio', async () => {
    currentUser = userWith(['AUDITOR']);
    mockedApiRequest.mockImplementation(async (path) => {
      if (path.startsWith('/v1/approval-requests/')) {
        return {
          ...REQUEST,
          artifactVersion: { ...REQUEST.artifactVersion, sourceVersionId: '54' },
        };
      }
      if (path === '/v1/artifact-versions/54/graph') {
        return { nodes: [{ key: 'EVAL', type: 'CONDITION', label: 'Evalúa score' }] };
      }
      if (path === '/v1/artifact-versions/55/graph') {
        return {
          nodes: [
            { key: 'EVAL', type: 'CONDITION', label: 'Evalúa buró' },
            { key: 'REVISION', type: 'RESULT', label: 'Revisión manual' },
          ],
        };
      }
      return {};
    });
    renderPage();

    expect(await screen.findByText('nodes.EVAL.label')).toBeInTheDocument();
    expect(screen.getByText('Evalúa score')).toBeInTheDocument();
    expect(screen.getByText('Evalúa buró')).toBeInTheDocument();
    expect(screen.getByText('nodes.REVISION')).toBeInTheDocument();
  });

  it('avisa cuando el ambiente avanzó por debajo de la versión en revisión', async () => {
    currentUser = userWith(['AUDITOR']);
    mockedApiRequest.mockImplementation(async (path) => {
      if (path.startsWith('/v1/approval-requests/')) {
        return {
          ...REQUEST,
          artifactVersion: { ...REQUEST.artifactVersion, sourceVersionId: '54' },
        };
      }
      if (path.startsWith('/v1/deployments')) {
        return {
          items: [
            {
              id: 'd1',
              environment: { code: 'PROD' },
              deploymentStatus: 'ACTIVE',
              deployedAt: '2026-07-30T10:00:00Z',
              deployedBy: 'admin@atlas.bo',
              artifactVersion: { id: '60', versionNumber: '6' },
            },
          ],
        };
      }
      return {};
    });
    renderPage();

    expect(await screen.findByText(/el objetivo avanzó/)).toBeInTheDocument();
  });

  it('ante un 409 relee el estado y avisa de que la solicitud cambió', async () => {
    currentUser = userWith(['RISK_APPROVER']);
    mockedApiRequest.mockImplementation(async (path) => {
      if (path.endsWith('/decisions')) {
        throw new ApiError('El paso ya fue decidido.', 409, 'STEP_ALREADY_DECIDED');
      }
      return REQUEST;
    });
    renderPage();

    const comment = await screen.findByRole('textbox');
    fireEvent.change(comment, { target: { value: 'Conforme.' } });
    fireEvent.click(screen.getByRole('button', { name: /Aprobar Despliegue/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Firmar aprobación/ }));

    expect(await screen.findByText(/cambió mientras la revisabas/)).toBeInTheDocument();
  });
});
