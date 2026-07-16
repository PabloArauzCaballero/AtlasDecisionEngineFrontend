'use client';

import { TestSuitesPage } from '../../../../../pages/TestSuitesPage';
import { useRouteParam } from '../../../../../shared/navigation/useRouteParam';

export default function ArtifactVersionTestSuitesRoute() {
  const versionId = useRouteParam('versionId');
  return <TestSuitesPage initialVersionId={versionId} />;
}
