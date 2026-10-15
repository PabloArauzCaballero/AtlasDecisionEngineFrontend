import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PendingStatementReviews } from './PendingStatementReviews';

const fetchStatementReviews = vi.fn();
vi.mock('../workers/statement-review.api', () => ({
  fetchStatementReviews: (...a: unknown[]) => fetchStatementReviews(...a),
}));

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PendingStatementReviews />
    </QueryClientProvider>,
  );
}

const pagina = (pendingMs: number[]) => ({
  items: pendingMs.map((ms, i) => ({ requestId: `bs-${i}`, pendingMs: ms })),
  page: 1,
  pageSize: 50,
  total: pendingMs.length,
  totalPages: 1,
  hasNextPage: false,
});

describe('PendingStatementReviews · los extractos no se quedan sin mirar', () => {
  it('anuncia cuántos esperan, desde cuándo y enlaza a su bandeja', async () => {
    fetchStatementReviews.mockResolvedValueOnce(pagina([8 * 24 * 3_600_000, 3_600_000]));
    pintar();
    expect(await screen.findByText('2 extractos bancarios esperan revisión')).toBeTruthy();
    expect(screen.getByText(/hace 8 días/)).toBeTruthy();
    expect(screen.getByText(/pasó el plazo de 24 h/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Revisar extractos' }).getAttribute('href')).toBe(
      '/workers/bank-statement?vista=revision',
    );
  });

  it('sin casos no pinta nada', async () => {
    fetchStatementReviews.mockResolvedValueOnce(pagina([]));
    const { container } = pintar();
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[data-testid="pending-statement-reviews"]')).toBeNull();
  });
});
