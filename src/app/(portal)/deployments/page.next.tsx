'use client';

import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

export default function DeploymentsRoute() {
  return <ResourceListPage config={resources.deployments} />;
}
