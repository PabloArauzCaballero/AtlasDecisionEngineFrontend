'use client';

import { use } from 'react';
import { CalculatedFieldDetailPage } from '../../../../pages/CalculatedFieldDetailPage';

export default function CalculatedFieldDetailRoute({
  params,
}: {
  params: Promise<{ fieldId: string }>;
}) {
  const { fieldId } = use(params);
  return <CalculatedFieldDetailPage fieldId={fieldId} />;
}
