'use client';

import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

export default function AuditEventsRoute() {
  return <ResourceListPage config={resources['audit-events']} />;
}
