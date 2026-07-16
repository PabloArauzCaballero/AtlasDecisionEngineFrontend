'use client';

import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

export default function ManualReviewsRoute() {
  return <ResourceListPage config={resources['manual-reviews']} />;
}
