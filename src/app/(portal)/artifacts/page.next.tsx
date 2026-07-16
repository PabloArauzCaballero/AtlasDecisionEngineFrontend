'use client';

import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

export default function ArtifactsRoute() {
  return <ResourceListPage config={resources.artifacts} />;
}
