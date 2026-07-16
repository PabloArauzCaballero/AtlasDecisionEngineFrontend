'use client';

import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

export default function ObjectivesRoute() {
  return <ResourceListPage config={resources.objectives} />;
}
