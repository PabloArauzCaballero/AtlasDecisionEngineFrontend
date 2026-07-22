'use client';

import { useEffect, useState } from 'react';
import { GraphEditorPage } from '../../../pages/GraphEditorPage';

/**
 * Reads the optional `?versionId=` deep link (used by "Edit Draft" on the
 * artifact detail page) before mounting the editor, because the editor only
 * consumes the version as initial state.
 */
export default function GraphEditorRoute() {
  const [initialVersionId, setInitialVersionId] = useState<string | null>(null);

  useEffect(() => {
    setInitialVersionId(new URLSearchParams(window.location.search).get('versionId') ?? '');
  }, []);

  if (initialVersionId === null) return null;
  return <GraphEditorPage initialVersionId={initialVersionId} />;
}
