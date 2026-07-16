'use client';

import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

export default function ReviewsRoute() {
  return <ResourceListPage config={resources.reviews} />;
}
