'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { QaLabPage } from '../../../pages/QaLabPage';
import { RouteSkeleton } from '../../../components/RouteSkeleton';

function QaLabRouteBody() {
  const params = useSearchParams();
  return <QaLabPage initialVersionId={params?.get('versionId') ?? ''} />;
}

export default function QaLabRoute() {
  return (
    <Suspense fallback={<RouteSkeleton />}>
      <QaLabRouteBody />
    </Suspense>
  );
}
