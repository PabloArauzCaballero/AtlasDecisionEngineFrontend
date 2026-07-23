'use client';

import { useQuery } from '@tanstack/react-query';
import { GitBranch, ScrollText, TerminalSquare } from 'lucide-react';
import Link from 'next/link';
import { apiRequest } from '../../api/http-client';
import { StatusBadge } from '../../components/StatusBadge';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * Lazy-loaded version list for one algorithm (artifact), shown when its row is
 * expanded in the Algorithms table. Reads the artifact detail (which nests its
 * versions) so the main table stays a light list until the user drills in.
 */
export function AlgorithmVersions({ artifactId }: { artifactId: string }) {
  const query = useQuery({
    queryKey: ['algorithm-versions', artifactId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/artifacts/${encodeURIComponent(artifactId)}`, { signal }),
  });

  if (query.isPending) {
    return <div className="algo-versions-note">Cargando versiones…</div>;
  }
  if (query.isError) {
    return <div className="algo-versions-note error">No se pudieron cargar las versiones.</div>;
  }
  const versions = asRows(asRecord(query.data).versions);
  if (!versions.length) {
    return <div className="algo-versions-note">Este algoritmo aún no tiene versiones.</div>;
  }

  return (
    <div className="algo-versions">
      {versions.map((version) => {
        const versionId = display(version, 'id');
        return (
          <div className="algo-version" key={versionId}>
            <div className="algo-version-head">
              <strong>v{display(version, 'semanticVersion', 'versionNumber')}</strong>
              <StatusBadge value={version.status} />
            </div>
            <dl className="algo-version-meta">
              <div>
                <dt>Creada</dt>
                <dd>{display(version, 'createdAt')}</dd>
              </div>
              <div>
                <dt>Autor</dt>
                <dd>{display(version, 'createdBy')}</dd>
              </div>
              <div>
                <dt>Resumen del cambio</dt>
                <dd>{display(version, 'changeSummary')}</dd>
              </div>
            </dl>
            <div className="algo-version-actions">
              <Link className="button" href={`/artifact-versions/${versionId}/graph`}>
                <GitBranch size={14} /> Ver grafo
              </Link>
              <Link className="button" href={`/artifact-versions/${versionId}/compile`}>
                <ScrollText size={14} /> Validar / compilar
              </Link>
              <Link className="button" href={`/artifact-versions/${versionId}/test-suites`}>
                <TerminalSquare size={14} /> Pruebas
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
