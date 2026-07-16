'use client';

import { GraphEditorPage } from '../../../../../pages/GraphEditorPage';
import { useRouteParam } from '../../../../../shared/navigation/useRouteParam';

export default function ArtifactVersionGraphRoute() {
  const versionId = useRouteParam('versionId');
  return <GraphEditorPage initialVersionId={versionId} />;
}
