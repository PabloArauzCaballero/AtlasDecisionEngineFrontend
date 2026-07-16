'use client';

import { CompilePage } from '../../../../../pages/CompilePage';
import { useRouteParam } from '../../../../../shared/navigation/useRouteParam';

export default function CompileRoute() {
  const versionId = useRouteParam('versionId');
  return <CompilePage initialVersionId={versionId} />;
}
