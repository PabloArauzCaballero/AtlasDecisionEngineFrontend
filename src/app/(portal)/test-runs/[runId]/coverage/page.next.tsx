'use client';

import { GraphCoveragePage } from '../../../../../pages/GraphCoveragePage';
import { useRouteParam } from '../../../../../shared/navigation/useRouteParam';

export default function TestRunCoverageRoute() {
  const runId = useRouteParam('runId');
  return <GraphCoveragePage initialRunId={runId} />;
}
