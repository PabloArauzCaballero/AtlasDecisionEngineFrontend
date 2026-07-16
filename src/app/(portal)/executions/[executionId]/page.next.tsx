'use client';

import { ExecutionDetailPage } from '../../../../pages/ExecutionDetailPage';
import { useRouteParam } from '../../../../shared/navigation/useRouteParam';

export default function ExecutionDetailRoute() {
  const executionId = useRouteParam('executionId');
  return <ExecutionDetailPage executionId={executionId} />;
}
