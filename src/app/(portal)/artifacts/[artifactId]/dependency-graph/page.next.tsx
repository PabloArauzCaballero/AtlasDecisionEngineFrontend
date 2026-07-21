'use client';

import { DependencyGraphPage } from '../../../../../pages/DependencyGraphPage';
import { useRouteParam } from '../../../../../shared/navigation/useRouteParam';

export default function ArtifactDependencyGraphRoute() {
  const artifactId = useRouteParam('artifactId');
  return <DependencyGraphPage artifactId={artifactId} />;
}
