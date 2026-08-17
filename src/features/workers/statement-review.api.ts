import { apiRequest } from '../../api/http-client';
import type {
  ReviewAction,
  StatementRejectionReason,
  StatementReviewCategory,
  StatementReviewDetail,
  StatementReviewItem,
  StatementReviewReason,
} from './statement-review';

/**
 * La cola de revisión de extractos.
 *
 * Todo el filtrado y la paginación viajan al motor. Traerse la cola entera y
 * filtrarla en el navegador es la variante que funciona con doce casos y deja la
 * pantalla inservible con cuatro mil, que es justo el día en que hace falta.
 */

export interface StatementReviewQuery {
  page?: number;
  pageSize?: number;
  category?: StatementReviewReason;
  status?: 'PENDING_REVIEW' | 'IN_REVIEW';
  bank?: string;
  dateFrom?: string;
  dateTo?: string;
  priority?: number;
}

export interface StatementReviewPage {
  items: StatementReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export async function fetchStatementReviews(
  query: StatementReviewQuery,
  signal?: AbortSignal,
): Promise<StatementReviewPage> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
  });
  if (query.category) params.set('category', query.category);
  if (query.status) params.set('status', query.status);
  if (query.bank) params.set('bank', query.bank);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  if (query.priority) params.set('priority', String(query.priority));

  const payload = await apiRequest<Partial<StatementReviewPage> | null>(
    `/v1/workers/bank-statement/reviews?${params.toString()}`,
    { signal },
  );
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    items,
    page: payload?.page ?? 1,
    pageSize: payload?.pageSize ?? items.length,
    total: payload?.total ?? items.length,
    totalPages: payload?.totalPages ?? 1,
    hasNextPage: payload?.hasNextPage ?? false,
  };
}

/**
 * Los contadores de las pestañas. Vienen del motor sobre la cola COMPLETA: si se
 * dedujeran de la página cargada, el rótulo diría «Timeout (4)» sobre una cola
 * de cuatrocientos y nadie sabría que hay más.
 */
export async function fetchStatementReviewCategories(
  signal?: AbortSignal,
): Promise<StatementReviewCategory[]> {
  const payload = await apiRequest<unknown>('/v1/workers/bank-statement/reviews/categories', {
    signal,
  });
  if (Array.isArray(payload)) return payload as StatementReviewCategory[];
  const envelope = payload as { items?: unknown } | null;
  return Array.isArray(envelope?.items) ? (envelope.items as StatementReviewCategory[]) : [];
}

export function fetchStatementReview(
  requestId: string,
  signal?: AbortSignal,
): Promise<StatementReviewDetail> {
  return apiRequest<StatementReviewDetail>(
    `/v1/workers/bank-statement/reviews/${encodeURIComponent(requestId)}`,
    { signal },
  );
}

export function claimStatementReview(requestId: string): Promise<StatementReviewDetail> {
  return apiRequest<StatementReviewDetail>(
    `/v1/workers/bank-statement/reviews/${encodeURIComponent(requestId)}/claim`,
    { method: 'POST' },
  );
}

export function resolveStatementReview(
  requestId: string,
  body: { action: ReviewAction; notes: string; rejectionReason?: StatementRejectionReason },
): Promise<unknown> {
  return apiRequest(`/v1/workers/bank-statement/reviews/${encodeURIComponent(requestId)}/resolve`, {
    method: 'POST',
    body,
  });
}

export function reprocessStatementReview(requestId: string): Promise<unknown> {
  return apiRequest(
    `/v1/workers/bank-statement/reviews/${encodeURIComponent(requestId)}/reprocess`,
    { method: 'POST' },
  );
}
