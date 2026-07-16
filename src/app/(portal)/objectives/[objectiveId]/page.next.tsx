'use client';

import { ObjectiveDetailPage } from '../../../../pages/ObjectiveDetailPage';
import { useRouteParam } from '../../../../shared/navigation/useRouteParam';

export default function ObjectiveDetailRoute() {
  const objectiveId = useRouteParam('objectiveId');
  return <ObjectiveDetailPage objectiveId={objectiveId} />;
}
