'use client';

import { useState } from 'react';
import { usePickerDefault } from '../components/usePickerDefault';

/**
 * Qué versión enseña la pantalla de suites.
 *
 * Mientras nadie elige (`null`), abre con la versión más reciente que TIENE suites, para enseñar
 * pruebas reales en vez de un selector vacío. Un enlace directo (`initialVersionId`) manda.
 */
export function useSuiteVersionSelection(initialVersionId: string) {
  const [draftId, setDraftId] = useState(initialVersionId);
  const [chosen, setVersionId] = useState<string | null>(initialVersionId || null);
  const autoVersionId = usePickerDefault({
    endpoint: '/v1/views/pickers/test-suites',
    queryKey: 'test-suites',
    enabled: chosen === null,
    valueKey: 'artifactVersionId',
  });
  return {
    versionId: chosen ?? autoVersionId,
    setVersionId,
    draftId,
    /** Para `<ArtifactVersionPicker>`: abre ya con la versión propuesta elegida. */
    pickerProps: {
      versionId: draftId,
      onVersionChange: setDraftId,
      initialVersionId: initialVersionId || autoVersionId || undefined,
    },
  };
}
