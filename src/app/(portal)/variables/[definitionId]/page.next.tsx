'use client';

import { use } from 'react';
import { VariableContractPage } from '../../../../pages/VariableContractPage';

export default function VariableContractRoute({
  params,
}: {
  params: Promise<{ definitionId: string }>;
}) {
  const { definitionId } = use(params);
  return <VariableContractPage definitionId={definitionId} />;
}
