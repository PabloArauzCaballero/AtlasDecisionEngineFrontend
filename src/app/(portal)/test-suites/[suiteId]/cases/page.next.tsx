'use client';

import { TestCasesPage } from '../../../../../pages/TestCasesPage';
import { useRouteParam } from '../../../../../shared/navigation/useRouteParam';

export default function TestSuiteCasesRoute() {
  const suiteId = useRouteParam('suiteId');
  return <TestCasesPage initialSuiteId={suiteId} />;
}
