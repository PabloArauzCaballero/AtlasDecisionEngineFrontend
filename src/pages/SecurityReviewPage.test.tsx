import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { apiRequest } from '../api/http-client';
import type { IdentityUser } from '../auth/auth.types';
import { SecurityReviewPage } from './SecurityReviewPage';

/**
 * La revisión de seguridad era una segunda puerta de firma sin ninguna salvaguarda: un clic
 * firmaba el primer paso PENDING que apareciera, sin comentario, sin confirmación, sin clave de
 * idempotencia y a la vista de un AUDITOR. Ahora firma igual que la solicitud de aprobación.
 */

const notify = vi.fn();
let currentUser: IdentityUser | null = null;

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../notifications/useNotifications', () => ({
  useNotifications: () => ({ notify }),
}));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: currentUser }),
  useEffectiveRoles: () => [...(currentUser?.roles ?? []), ...(currentUser?.legacyRoles ?? [])],
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedApiRequest = vi.mocked(apiRequest);

function userWith(roles: string[], email = 'aprobador@atlas.bo'): IdentityUser {
  return {
    id: '7',
    tenantId: '1',
    email,
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

const CLOSED_REQUEST = {
  // Solicitud vieja, cerrada, con un paso que quedó PENDING: no se firma.
  id: '20',
  status: 'REJECTED',
  requestedBy: 'autor@atlas.bo',
  requestedAt: '2026-09-01T10:00:00.000Z',
  steps: [{ id: '200', stepOrder: 1, requiredRole: 'RISK_APPROVER', status: 'PENDING' }],
};

const REVIEW = {
  artifact: { name: 'Scoring de crédito', artifactCode: 'SCORING_CREDITO' },
  version: { id: '55', semanticVersion: '1.4.0', status: 'IN_REVIEW' },
  governance: [
    CLOSED_REQUEST,
    {
      id: '31',
      status: 'IN_REVIEW',
      requestedBy: 'autor@atlas.bo',
      requestedAt: '2026-10-01T10:00:00.000Z',
      // Desordenados a propósito: el paso a firmar es el pendiente de menor orden.
      steps: [
        { id: '312', stepOrder: 2, requiredRole: 'COMPLIANCE', status: 'PENDING', decisions: [] },
        {
          id: '311',
          stepOrder: 1,
          requiredRole: 'RISK_APPROVER',
          status: 'PENDING',
          decisions: [],
        },
        {
          id: '310',
          stepOrder: 0,
          requiredRole: 'QA_ANALYST',
          status: 'APPROVED',
          decisions: [
            {
              decidedBy: 'qa@atlas.bo',
              decision: 'APPROVE',
              comments: 'ok',
              decidedAt: '2026-10-02T09:00:00.000Z',
            },
          ],
        },
      ],
    },
  ],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SecurityReviewPage versionId="55" />
    </QueryClientProvider>,
  );
}

const signingCalls = () =>
  mockedApiRequest.mock.calls.filter(([path]) => String(path).includes('/approval-steps/'));

describe('SecurityReviewPage · firma', () => {
  beforeEach(() => {
    notify.mockReset();
    mockedApiRequest.mockReset();
    mockedApiRequest.mockImplementation(async (path) =>
      path.startsWith('/v1/security-review/') ? REVIEW : {},
    );
  });

  it('no ofrece firmar a un AUDITOR', async () => {
    currentUser = userWith(['AUDITOR']);
    renderPage();

    expect(await screen.findByText(/Este paso requiere el rol RISK_APPROVER/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aprobar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rechazar/ })).not.toBeInTheDocument();
  });

  it('no ofrece firmar a quien pidió la revisión', async () => {
    currentUser = userWith(['RISK_APPROVER'], 'autor@atlas.bo');
    renderPage();

    expect(await screen.findByText(/Solicitaste tú esta revisión/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aprobar/ })).not.toBeInTheDocument();
  });

  it('enseña quién firmó cada paso', async () => {
    currentUser = userWith(['AUDITOR']);
    renderPage();

    expect(await screen.findByText(/Firmó qa@atlas.bo \(APPROVE\)/)).toBeInTheDocument();
  });

  it('exige comentario, confirma y firma el paso de menor orden con clave de idempotencia', async () => {
    currentUser = userWith(['RISK_APPROVER']);
    renderPage();

    const approve = await screen.findByRole('button', { name: /Aprobar/ });
    expect(approve).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Revisado el código y los accesos.' },
    });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);

    // El clic sólo abre la confirmación: todavía no se ha firmado nada.
    expect(signingCalls()).toHaveLength(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Firmar aprobación' }));

    await waitFor(() => expect(signingCalls()).toHaveLength(1));
    const [path, init] = signingCalls()[0];
    expect(path).toBe('/v1/approval-steps/311/decisions');
    expect(init).toMatchObject({
      method: 'POST',
      body: { decision: 'APPROVE', comments: 'Revisado el código y los accesos.' },
    });
    expect((init as { headers: Record<string, string> }).headers['Idempotency-Key']).toMatch(
      /^approval-decision-/,
    );
  });

  it('sin solicitud abierta no hay panel de firma', async () => {
    currentUser = userWith(['RISK_APPROVER']);
    mockedApiRequest.mockImplementation(async (path) =>
      path.startsWith('/v1/security-review/') ? { ...REVIEW, governance: [CLOSED_REQUEST] } : {},
    );
    renderPage();

    await screen.findByText('Scoring de crédito');
    expect(screen.queryByText('Tu firma')).not.toBeInTheDocument();
  });
});
