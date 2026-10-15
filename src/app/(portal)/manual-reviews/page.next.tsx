'use client';

import { PendingStatementReviews } from '../../../features/manual-review/PendingStatementReviews';
import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

export default function ManualReviewsRoute() {
  // Los extractos en duda viven en su propia bandeja: aquí se anuncian para que no se queden sin mirar.
  return <ResourceListPage config={resources['manual-reviews']} intro={<PendingStatementReviews />} />;
}
