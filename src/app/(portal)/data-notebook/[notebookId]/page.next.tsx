'use client';

import { use } from 'react';
import { DataNotebookDetailPage } from '../../../../pages/DataNotebookDetailPage';

export default function DataNotebookDetailRoute({
  params,
}: {
  params: Promise<{ notebookId: string }>;
}) {
  const { notebookId } = use(params);
  return <DataNotebookDetailPage notebookId={notebookId} />;
}
