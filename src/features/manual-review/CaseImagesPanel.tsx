import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiRequest } from '../../api/http-client';
import { apiDownload } from '../../api/file-download';
import { CarruselDeDocumentos } from '../../components/CarruselDeDocumentos';
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

interface EvidenceResponse {
  customerId: string;
  documents: EvidenceDocument[];
}

interface EvidenceDocument {
  documentId: string;
  documentType: string;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
}

/** Documento ya con su imagen traída como blob local (URL de objeto lista para `<img>`). */
interface EvidenceImage extends EvidenceDocument {
  objectUrl: string;
}

export function CaseImagesPanel({ attemptId }: Readonly<{ attemptId: string }>) {
  const query = useQuery({
    queryKey: ['case-images', attemptId],
    enabled: Boolean(attemptId),
    queryFn: async ({ signal }): Promise<{ customerId: string; documents: EvidenceImage[] }> => {
      /*
       * Los bytes de la imagen se piden por la MISMA puerta autenticada que todo lo demás y se
       * pintan desde un blob local. Antes el `src` apuntaba directo a la ruta `/content`, y una
       * etiqueta `<img>` NO puede mandar `Authorization` —sólo tiene una dirección—, así que el
       * motor devolvía 401 y el analista se quedaba sin ver el carnet ni la selfie. Es el mismo
       * arreglo que ya tenían el audio (`downloadAudio`) y las descargas (`apiDownload`): la
       * credencial va puesta, la renovación de token vale igual, y el inquilino/rol los sigue
       * decidiendo el servidor (no una URL pública que expondría PII fuera de sus controles).
       */
      const body = await apiRequest<{ data?: EvidenceResponse } & Partial<EvidenceResponse>>(
        `/atlas-backend/customer-onboarding/identity-verifications/${attemptId}/evidence-documents`,
        { signal },
      );
      const meta = body.data ?? {
        customerId: body.customerId ?? '',
        documents: body.documents ?? [],
      };
      const documents = await Promise.all(
        meta.documents.map(async (document): Promise<EvidenceImage> => {
          const file = await apiDownload(
            `/atlas-backend/customer-onboarding/${meta.customerId}/evidence-documents/${document.documentId}/content`,
            `${document.documentType}-${document.documentId}`,
            { signal },
          );
          return { ...document, objectUrl: URL.createObjectURL(file.blob) };
        }),
      );
      return { customerId: meta.customerId, documents };
    },
  });

  // Las URL de objeto se liberan al cambiar de caso o desmontar: sin esto, cada caso mirado deja
  // sus blobs en memoria hasta recargar la pestaña.
  useEffect(() => {
    const urls = query.data?.documents.map((document) => document.objectUrl) ?? [];
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [query.data]);

  if (!attemptId) return null;

  return (
    <Panel title="Documentos del solicitante" meta="lo que subió el cliente">
      {query.isLoading ? <p className="muted">Cargando las imágenes…</p> : null}
      {query.error ? (
        <p className="muted">
          No se pudieron traer las imágenes desde AtlasBackend. La decisión debería tomarse con
          ellas delante.
        </p>
      ) : null}

      {query.data?.documents.length ? (
        <CarruselDeDocumentos
          etiquetaDelGrupo="Documentos del solicitante"
          documentos={query.data.documents.map((documento) => ({
            id: documento.documentId,
            etiqueta: ETIQUETA[documento.documentType] ?? documento.documentType,
            objectUrl: documento.objectUrl,
            // El hash prueba que ESTA imagen es la que el motor evaluó: su instantánea de entrada
            // guarda el mismo valor. Sin él, «vi la foto» y «vi la foto que se decidió» son la
            // misma frase para dos cosas distintas.
            pie: documento.sha256 ? `${documento.sha256.slice(0, 12)}…` : undefined,
          }))}
        />
      ) : null}
    </Panel>
  );
}
