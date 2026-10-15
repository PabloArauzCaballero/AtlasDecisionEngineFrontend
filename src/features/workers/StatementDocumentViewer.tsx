'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { saveFile } from '../documents/save-file';
import { fetchStatementDocument } from './statement-review.api';

/**
 * El PDF que subió el cliente, a la vista de quien revisa.
 *
 * Pablo (2026-10-15): «no me deja ver el PDF subido, para poder manualmente ponerle la entidad». El
 * caso sólo decía «el PDF original sigue guardado»; no había forma de abrirlo. Se pide al motor con la
 * sesión (un enlace directo no lleva la credencial), se muestra en un marco `blob:` —permitido por
 * `frame-src` en la CSP— y se puede descargar. Se pide sólo al abrir el visor: es el documento más
 * pesado y sensible del caso.
 */
export function StatementDocumentViewer({
  requestId,
  fileName,
  available,
}: {
  requestId: string;
  fileName: string;
  available: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const documento = useQuery({
    queryKey: ['statement-review-document', requestId],
    queryFn: ({ signal }) => fetchStatementDocument(requestId, fileName, signal),
    enabled: abierto && available,
    staleTime: Infinity,
    retry: false,
  });
  const url = useMemo(
    () => (documento.data ? URL.createObjectURL(documento.data.blob) : null),
    [documento.data],
  );
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

  if (!available) {
    return (
      <p className="field-help">
        El PDF original ya no está guardado. Para volver a intentarlo hay que subirlo de nuevo.
      </p>
    );
  }

  return (
    <section className="revision-caso-documento" data-testid="statement-document">
      <div className="worker-run-actions">
        <button
          type="button"
          className="button"
          aria-expanded={abierto}
          onClick={() => setAbierto((valor) => !valor)}
        >
          {abierto ? 'Ocultar el PDF' : 'Ver el PDF subido'}
        </button>
        {documento.data ? (
          <button
            type="button"
            className="button"
            onClick={() => saveFile(documento.data.blob, documento.data.fileName || fileName)}
          >
            Descargar
          </button>
        ) : null}
      </div>
      {abierto ? (
        documento.isPending ? (
          <p className="categoria-vacio">Cargando el documento…</p>
        ) : documento.isError ? (
          <p className="categoria-vacio">
            No se pudo abrir el PDF: {(documento.error as Error).message}
          </p>
        ) : url ? (
          <iframe className="case-files__viewer" src={url} title={`Extracto ${fileName}`} />
        ) : null
      ) : null}
    </section>
  );
}
