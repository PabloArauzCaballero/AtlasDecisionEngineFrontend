'use client';

import { ManualReviewDetailPage } from '../../../../pages/ManualReviewDetailPage';
import { useRouteParam } from '../../../../shared/navigation/useRouteParam';

export default function ManualReviewDetailRoute() {
  const caseId = useRouteParam('caseId');
  return <ManualReviewDetailPage caseId={caseId} />;
}
