'use client';

import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

export default function VariablesRoute() {
  return <ResourceListPage config={resources.variables} />;
}
