import { apiRequest } from '../../api/http-client';
import type {
  IdentityConfirmableType,
  IdentityRejectionReason,
  IdentityReviewCategory,
  IdentityReviewItem,
  IdentityReviewReason,
} from './identity-review';

/**
 * La cola de arbitraje de identidad.
 *
 * Todo el filtrado y la paginación viajan al motor. Traerse la cola entera y
 * filtrarla en el navegador es la variante que funciona con doce casos y deja la
 * pantalla inservible con cuatro mil, que es justo el día en que hace falta.
 */

const BASE = '/v1/workers/identity-verification/reviews';

export interface IdentityReviewQuery {
  page?: number;
  pageSize?: number;
  category?: IdentityReviewReason;
  status?: 'PENDING_REVIEW' | 'IN_REVIEW';
}

export interface IdentityReviewPage {
  items: IdentityReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export async function fetchIdentityReviews(
  query: IdentityReviewQuery,
  signal?: AbortSignal,
): Promise<IdentityReviewPage> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
  });
  if (query.category) params.set('category', query.category);
  if (query.status) params.set('status', query.status);

  const payload = await apiRequest<Partial<IdentityReviewPage> | null>(
    `${BASE}?${params.toString()}`,
    { signal },
  );
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    items,
    page: payload?.page ?? 1,
    pageSize: payload?.pageSize ?? 20,
    total: payload?.total ?? items.length,
    totalPages: payload?.totalPages ?? 1,
    hasNextPage: payload?.hasNextPage ?? false,
  };
}

export async function fetchIdentityReviewCategories(
  signal?: AbortSignal,
): Promise<IdentityReviewCategory[]> {
  const payload = await apiRequest<IdentityReviewCategory[] | null>(`${BASE}/categories`, {
    signal,
  });
  return Array.isArray(payload) ? payload : [];
}

export function claimIdentityReview(requestId: string): Promise<IdentityReviewItem> {
  return apiRequest<IdentityReviewItem>(`${BASE}/${encodeURIComponent(requestId)}/claim`, {
    method: 'POST',
  });
}

export function resolveIdentityReview(
  requestId: string,
  body: {
    action: 'CONFIRM_DOCUMENT' | 'REJECT_DOCUMENT';
    notes: string;
    documentType?: IdentityConfirmableType;
    rejectionReason?: IdentityRejectionReason;
  },
): Promise<unknown> {
  return apiRequest(`${BASE}/${encodeURIComponent(requestId)}/resolve`, {
    method: 'POST',
    body,
  });
}
