import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { apiRequest } from '../api/http-client';
import type { IdentityUser } from '../auth/auth.types';
import { ManualReviewDetailPage } from './ManualReviewDetailPage';

const notify = vi.fn();
let currentUser: IdentityUser | null = null;

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../notifications/useNotifications', () => ({
  useNotifications: () => ({ notify }),
}));
vi.mock('../features/tutorial/useInteractiveTutorial', () => ({
  useInteractiveTutorial: () => ({ startForError: vi.fn() }),
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

/** La forma real de `GET /v1/manual-reviews/:id` (`ManualReviewDetailDto`). */
function caso(sobrescribe: Record<string, unknown> = {}) {
  return {
    id: '12',
    executionId: '88',
    caseCode: 'MR-2026-0042',
    queueCode: 'IDENTIDAD',
    priority: 100,
    status: 'ASSIGNED',
    assignedTo: 'analista@atlas.bo',
    dueAt: '2026-09-30T10:00:00.000Z',
    evidenceJson: {},
    resolutionJson: null,
    createdAt: '2026-09-29T10:00:00.000Z',
    resolvedAt: null,
    execution: {
      id: '88',
      requestId: 'req-8f2a',
      businessOutcome: 'MANUAL_REVIEW',
      executedAt: '2026-09-29T09:59:00.000Z',
      artifactVersion: { artifact: { artifactCode: 'IDENTIDAD_V1' } },
    },
    ...sobrescribe,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ManualReviewDetailPage caseId="12" />
    </QueryClientProvider>,
  );
}

function servir(review: Record<string, unknown>) {
  mockedApiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') return review;
    return path === '/v1/manual-reviews/12' ? review : {};
  });
}

async function elegir(rotulo: string) {
  fireEvent.click(await screen.findByTestId('select-resolucion'));
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(rotulo) }));
}

describe('ManualReviewDetailPage', () => {
  beforeEach(() => {
    notify.mockReset();
    mockedApiRequest.mockReset();
    currentUser = userWith(['OPERATIONS']);
  });

  it('ofrece Aprobar, Rechazar y Cancelar caso, y nada que el motor no acepte', async () => {
    servir(caso());
    renderPage();

    fireEvent.click(await screen.findByTestId('select-resolucion'));
    const opciones = (await screen.findAllByRole('option')).map((fila) => fila.textContent ?? '');
    expect(opciones).toHaveLength(3);
    expect(opciones[0]).toMatch(/Aprobar/);
    expect(opciones[1]).toMatch(/Rechazar/);
    expect(opciones[2]).toMatch(/Cancelar caso/);
    expect(opciones.join(' ')).not.toMatch(/Escalar/);
  });

  it.each([
    ['Aprobar', 'APPROVE'],
    ['Rechazar', 'DECLINE'],
    ['Cancelar caso', 'CANCEL'],
  ])('«%s» manda decision=%s al motor', async (rotulo, decision) => {
    servir(caso());
    renderPage();
    await elegir(rotulo);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Porque sí.' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar la decisión/ }));

    await waitFor(() =>
      expect(mockedApiRequest).toHaveBeenCalledWith(
        '/v1/manual-reviews/12/resolve',
        expect.objectContaining({ method: 'POST', body: { decision, reason: 'Porque sí.' } }),
      ),
    );
  });

  it('la ficha enseña el artefacto, la ejecución y el plazo que el motor sí manda', async () => {
    servir(caso());
    renderPage();

    expect(await screen.findByText('IDENTIDAD_V1')).toBeInTheDocument();
    expect(screen.getByText('req-8f2a')).toBeInTheDocument();
    expect(screen.getByText('2026-09-30T10:00:00.000Z')).toBeInTheDocument();
  });

  it.each([
    ['RESOLVED_APPROVED', 'aprobado'],
    ['RESOLVED_DECLINED', 'rechazado'],
    ['CANCELLED', 'cancelado'],
  ])('un caso %s ya no admite resolverse ni asignarse', async (status, texto) => {
    servir(caso({ status, resolvedAt: '2026-09-29T11:00:00.000Z' }));
    renderPage();

    expect(
      await screen.findByText(new RegExp(`ya está cerrado \\(${texto}\\)`)),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar la decisión/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Asignármelo/ })).toBeDisabled();
  });
});
