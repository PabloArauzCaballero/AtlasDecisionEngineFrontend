'use client';

import { TestRunDetailPage } from '../../../../pages/TestRunDetailPage';
import { useRouteParam } from '../../../../shared/navigation/useRouteParam';

export default function TestRunDetailRoute() {
  const runId = useRouteParam('runId');
  return <TestRunDetailPage runId={runId} />;
}
