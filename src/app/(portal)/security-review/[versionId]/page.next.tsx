'use client';

import { SecurityReviewPage } from '../../../../pages/SecurityReviewPage';
import { useRouteParam } from '../../../../shared/navigation/useRouteParam';

export default function SecurityReviewRoute() {
  const versionId = useRouteParam('versionId');
  return <SecurityReviewPage versionId={versionId} />;
}
