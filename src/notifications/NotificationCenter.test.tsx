import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiRequest } from '../api/http-client';
import { NotificationCenter } from './NotificationCenter';

const push = vi.fn();

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const mockedApiRequest = vi.mocked(apiRequest);

const sampleItems = [
  {
    id: '10',
    category: 'GOVERNANCE',
    priority: 'NORMAL',
    title: 'Revisión solicitada: CREDIT-RISK',
    body: 'Requiere aprobación del rol QA_ANALYST.',
    actionUrl: '/approval-requests/10',
    eventType: 'version.submitted_for_review',
    readAt: null,
    createdAt: '2026-07-21T10:00:00.000Z',
  },
];

function mockBackend(unread: number) {
  mockedApiRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path === '/v1/notifications/unread-count') return { unread } as never;
    if (path.startsWith('/v1/notifications?')) {
      return { items: sampleItems, pageSize: 20, nextCursor: null, hasNextPage: false } as never;
    }
    if (options?.method === 'POST') return undefined as never;
    throw new Error(`unexpected path ${path}`);
  });
}

function renderCenter() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationCenter />
    </QueryClientProvider>,
  );
}

describe('NotificationCenter (persistent inbox)', () => {
  beforeEach(() => {
    push.mockReset();
    mockedApiRequest.mockReset();
  });

  it('shows the unread badge from the backend count', async () => {
    mockBackend(3);
    renderCenter();
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  // Generous timeouts: React Query's first fetch resolves quickly on a healthy machine,
  // but these suites also run on disk-starved CI where a single microtask flush can take
  // seconds (the badge query alone was observed at ~4s), so the default 5s test budget is
  // too tight for a chain of async waits. Mirrors the backend integration timeouts.
  const SLOW = 20_000;
  const findOpts = { timeout: 10_000 };

  it(
    'loads the inbox on open and marks an item read + navigates on click',
    async () => {
      mockBackend(1);
      renderCenter();

      fireEvent.click(screen.getByLabelText(/Notificaciones/));
      const item = await screen.findByText('Revisión solicitada: CREDIT-RISK', undefined, findOpts);
      fireEvent.click(item);

      await waitFor(
        () =>
          expect(mockedApiRequest).toHaveBeenCalledWith(
            '/v1/notifications/10/read',
            expect.objectContaining({ method: 'POST' }),
          ),
        findOpts,
      );
      expect(push).toHaveBeenCalledWith('/approval-requests/10');
    },
    SLOW,
  );

  it(
    'marks all read from the header action',
    async () => {
      mockBackend(2);
      renderCenter();
      // The header action is disabled until the unread count (2) has loaded.
      await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument(), findOpts);

      fireEvent.click(screen.getByLabelText(/Notificaciones/));
      const markAll = await screen.findByText('Marcar todas', undefined, findOpts);
      await waitFor(() => expect(markAll.closest('button')).toBeEnabled(), findOpts);
      fireEvent.click(markAll);

      await waitFor(
        () =>
          expect(mockedApiRequest).toHaveBeenCalledWith(
            '/v1/notifications/read-all',
            expect.objectContaining({ method: 'POST' }),
          ),
        findOpts,
      );
    },
    SLOW,
  );
});

describe('cierre con teclado del centro de notificaciones', () => {
  it('devuelve el foco a la campana al cerrar con Escape', async () => {
    mockBackend(3);
    renderCenter();
    const bell = await screen.findByRole('button', { name: /Notificaciones/ });

    bell.focus();
    fireEvent.click(bell);
    await screen.findByRole('dialog', { name: /Centro de notificaciones/ });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Sin esto el foco cae al <body> y hay que volver a tabular media página.
    expect(document.activeElement).toBe(bell);
  });
});
