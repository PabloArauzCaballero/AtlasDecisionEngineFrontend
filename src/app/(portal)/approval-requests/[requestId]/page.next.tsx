'use client';

import { ApprovalRequestDetailPage } from '../../../../pages/ApprovalRequestDetailPage';
import { useRouteParam } from '../../../../shared/navigation/useRouteParam';

export default function ApprovalRequestDetailRoute() {
  const requestId = useRouteParam('requestId');
  return <ApprovalRequestDetailPage requestId={requestId} />;
}
