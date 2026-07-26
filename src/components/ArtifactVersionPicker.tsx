'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/http-client';
import { asRecord, display, type UnknownRecord } from '../utils/records';
import { PickerSelect } from './PickerSelect';

interface ArtifactVersionPickerProps {
  /** Selected artifact version id (the value this control produces). */
  versionId: string;
  onVersionChange: (versionId: string) => void;
  versionLabel?: string;
  required?: boolean;
  /** Notified when the chosen artifact changes (some callers filter by it too). */
  onArtifactChange?: (artifactCode: string) => void;
  /**
   * Deep-linked version (e.g. `?versionId=` or a "compile this version" link). Its
   * artifact is resolved so both selects arrive pre-populated instead of empty.
   */
  initialVersionId?: string;
}

/**
 * Two-step reference picker: first choose the ARTIFACT, then a version — and the
 * version list is scoped to that artifact (`?artifactCode=`). Antes el selector de
 * versión mostraba las versiones de TODOS los artefactos; ahora sólo las del
 * artefacto elegido, que es lo que el usuario espera al preparar una operación
 * sobre un algoritmo concreto (compilar, revisar, probar…).
 */
export function ArtifactVersionPicker({
  versionId,
  onVersionChange,
  versionLabel = 'Versión del artefacto',
  required = false,
  onArtifactChange,
  initialVersionId,
}: ArtifactVersionPickerProps) {
  const [artifactCode, setArtifactCode] = useState('');
  const [seeded, setSeeded] = useState('');

  // Deep link: resolve the artifact of the pre-selected version so the artifact
  // select is not left blank while a version is already chosen.
  const seed = useQuery({
    queryKey: ['avp-seed', initialVersionId],
    queryFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/artifact-versions/${encodeURIComponent(initialVersionId ?? '')}`,
      ),
    enabled: Boolean(initialVersionId) && seeded !== initialVersionId,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!initialVersionId || seeded === initialVersionId || !seed.data) return;
    const code = display(asRecord(seed.data.artifact), 'artifactCode');
    if (code && code !== '—') setArtifactCode(code);
    onVersionChange(initialVersionId);
    setSeeded(initialVersionId);
  }, [initialVersionId, seeded, seed.data, onVersionChange]);

  const changeArtifact = (code: string) => {
    setArtifactCode(code);
    onArtifactChange?.(code);
    // Distinta lista de versiones: la selección anterior deja de ser válida.
    if (versionId) onVersionChange('');
  };

  const versionEndpoint = artifactCode
    ? `/v1/views/pickers/artifact-versions?artifactCode=${encodeURIComponent(artifactCode)}`
    : '/v1/views/pickers/artifact-versions';

  return (
    <div className="artifact-version-picker">
      <PickerSelect
        label="Artefacto"
        value={artifactCode}
        onChange={changeArtifact}
        endpoint="/v1/views/pickers/artifacts"
        queryKey="avp-artifacts"
        required={required}
        placeholder="Elegir artefacto…"
        mapOption={(row: UnknownRecord) => {
          const code = display(row, 'artifactCode');
          return code === '—' ? null : { value: code, label: `${code} · ${display(row, 'name')}` };
        }}
      />
      <PickerSelect
        label={versionLabel}
        value={versionId}
        onChange={onVersionChange}
        endpoint={versionEndpoint}
        queryKey={`avp-versions-${artifactCode || 'all'}`}
        required={required}
        disabled={!artifactCode}
        placeholder={artifactCode ? 'Elegir versión…' : 'Elige primero un artefacto'}
        mapOption={(row: UnknownRecord) => ({
          value: display(row, 'id'),
          label: `v${display(row, 'semanticVersion')} · ${display(row, 'status')}`,
        })}
      />
    </div>
  );
}
