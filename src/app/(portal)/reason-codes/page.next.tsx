'use client';

import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

export default function ReasonCodesRoute() {
  return <ResourceListPage config={resources['reason-codes']} />;
}
