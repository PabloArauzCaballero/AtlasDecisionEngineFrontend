import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Panel } from '../../components/Panel';

/**
 * Las fotos con las que hay que decidir.
 *
 * ## Por qué faltaban
 *
 * La revisión manual ocurre aquí, en el motor, pero las imágenes nunca salen de AtlasBackend: lo
 * único que el motor recibe de ellas es su hash. El resultado era que el analista abría el caso,
 * leía «parecido 0,90» y tenía que decidir si la persona del carnet es quien dice ser **sin ver ni
 * el carnet ni la cara**. Eso no es una revisión humana: es refrendar la cifra de una máquina.
 *
 * El caso conserva el `correlationId` —el id del intento de verificación—, y ese id es el que sabe
 * de quién son las imágenes. El backend expone ese salto; aquí sólo se pinta.
 *
 * ## Por qué se puede ampliar
 *
 * Porque la decisión se toma mirando detalles: si la MRZ del reverso se lee, si la cara de la selfie
 * es la del carnet, si el documento está manipulado. Una miniatura de 200 px no permite ninguna de
 * las tres.
 */
const ETIQUETA: Record<string, string> = {
  identity_front: 'Anverso del carnet',
  identity_back: 'Reverso del carnet',
  selfie: 'Selfie',
};

interface EvidenceDocument {
  documentId: string;
  documentType: string;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
}

export function CaseImagesPanel({ attemptId }: Readonly<{ attemptId: string }>) {
  const [ampliada, setAmpliada] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['case-images', attemptId],
    enabled: Boolean(attemptId),
    queryFn: async () => {
      /*
       * El tenant viaja en cabecera porque AtlasBackend lo exige en toda peticion: el proxy
       * reenvia lo que le llega del navegador, y `fetch` no lo pone solo.
       */
      const response = await fetch(
        `/atlas-backend/customer-onboarding/identity-verifications/${attemptId}/evidence-documents`,
        { headers: { 'x-tenant-id': '1' } },
      );
      if (!response.ok) throw new Error('No se pudieron leer los documentos');
      const body = (await response.json()) as { data?: { customerId: string; documents: EvidenceDocument[] } };
      return body.data ?? { customerId: '', documents: [] };
    },
  });

  if (!attemptId) return null;

  return (
    <Panel title="Documentos del solicitante" meta="lo que subió el cliente">
      {query.isLoading ? <p className="muted">Cargando las imágenes…</p> : null}
      {query.error ? (
        <p className="muted">
          No se pudieron traer las imágenes desde AtlasBackend. La decisión debería tomarse con ellas delante.
        </p>
      ) : null}

      {query.data?.documents.length ? (
        <div className="case-images-grid">
          {query.data.documents.map((document) => {
            const src = `/atlas-backend/customer-onboarding/${query.data.customerId}/evidence-documents/${document.documentId}/content?tenantId=1`;
            return (
              <figure key={document.documentId} className="case-image">
                <button type="button" className="case-image__button" onClick={() => setAmpliada(src)}>
                  <img src={src} alt={ETIQUETA[document.documentType] ?? document.documentType} loading="lazy" />
                </button>
                <figcaption>
                  <strong>{ETIQUETA[document.documentType] ?? document.documentType}</strong>
                  {/*
                    El hash se enseña porque es lo que prueba que ESTA imagen es la que el motor
                    evaluó: su instantánea de entrada guarda el mismo valor. Sin él, «vi la foto» y
                    «vi la foto que se decidió» son la misma frase para dos cosas distintas.
                  */}
                  <span className="mono">{document.sha256?.slice(0, 12)}…</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : null}

      {ampliada ? (
        <button type="button" className="case-image__overlay" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="Documento ampliado" />
        </button>
      ) : null}
    </Panel>
  );
}
