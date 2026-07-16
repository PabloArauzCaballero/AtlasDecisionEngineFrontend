'use client';

import { ArtifactDetailPage } from '../../../../pages/ArtifactDetailPage';
import { useRouteParam } from '../../../../shared/navigation/useRouteParam';

export default function ArtifactDetailRoute() {
  const artifactId = useRouteParam('artifactId');
  return <ArtifactDetailPage artifactId={artifactId} />;
}
