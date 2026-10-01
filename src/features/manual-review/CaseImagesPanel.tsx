import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiRequest } from '../../api/http-client';
import { apiDownload } from '../../api/file-download';
import { CarruselDeDocumentos } from '../../components/CarruselDeDocumentos';
import { Panel } from '../../components/Panel';
import { ApiError } from '../../api/ApiError';
import { resolveAdminPortalUrl } from '../../config/env';
import { imagenesDelExpediente, sujetoDelCaso } from './expediente-images';

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
  selfie: 'Selfie de frente',
  selfie_left: 'Selfie perfil izquierdo',
  selfie_right: 'Selfie perfil derecho',
};

/**
 * El orden en que se miran: el carnet por las dos caras y después la cara en sus tres poses. El
 * backend las devuelve en orden de subida, y comparar la selfie con el anverso exige tenerlos
 * juntos, no donde cayeron. Lo que no está en la lista va al final, en el orden en que llegó.
 */
const ORDEN = ['identity_front', 'identity_back', 'selfie', 'selfie_left', 'selfie_right'];

export function ordenarDocumentos<T extends { documentType: string }>(
  documentos: readonly T[],
): T[] {
  const posicion = (tipo: string) => {
    const index = ORDEN.indexOf(tipo);
    return index === -1 ? ORDEN.length : index;
  };
  return documentos
    .map((documento, index) => ({ documento, index }))
    .sort(
      (a, b) =>
        posicion(a.documento.documentType) - posicion(b.documento.documentType) ||
        a.index - b.index,
    )
    .map(({ documento }) => documento);
}

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

interface CaseImages {
  expedienteId: string | null;
  documents: EvidenceImage[];
}

/** El intento de verificación, si todavía existe: devuelve el cliente y los archivos del alta. */
async function documentosDelIntento(attemptId: string, signal: AbortSignal) {
  try {
    const body = await apiRequest<{ data?: EvidenceResponse } & Partial<EvidenceResponse>>(
      `/atlas-backend/customer-onboarding/identity-verifications/${attemptId}/evidence-documents`,
      { signal },
    );
    return {
      customerId: body.data?.customerId ?? body.customerId ?? '',
      documents: body.data?.documents ?? body.documents ?? [],
    };
  } catch (error) {
    // Un intento que ya no existe no es el fin: el cliente puede leerse del `requestId` y su
    // expediente conserva los archivos. Cualquier otro fallo (401, 500) sí se propaga.
    if (error instanceof ApiError && error.kind === 'not-found') return null;
    throw error;
  }
}

export function CaseImagesPanel({
  attemptId,
  requestId = '',
}: Readonly<{ attemptId: string; requestId?: string }>) {
  const sujeto = sujetoDelCaso(requestId);
  const query = useQuery({
    queryKey: ['case-images', attemptId, requestId],
    enabled: Boolean(attemptId) || Boolean(sujeto),
    queryFn: async ({ signal }): Promise<CaseImages> => {
      /*
       * Los bytes se piden por la MISMA puerta autenticada que todo lo demás y se pintan desde un
       * blob local: una etiqueta `<img>` no puede mandar `Authorization`, y una URL pública
       * expondría PII fuera de los controles de inquilino y rol del servidor.
       *
       * Orden: 1) los archivos del alta, si el intento existe; 2) el expediente del sujeto, que es
       * de donde los muestra el portal interno. El sujeto sale del `requestId` y, si no viene ahí
       * (casos de identidad anteriores), del intento.
       */
      const intento = attemptId ? await documentosDelIntento(attemptId, signal) : null;
      const traidos = await Promise.all(
        (intento?.documents ?? []).map(async (document): Promise<EvidenceImage | null> => {
          try {
            const file = await apiDownload(
              `/atlas-backend/customer-onboarding/${intento?.customerId}/evidence-documents/${document.documentId}/content`,
              `${document.documentType}-${document.documentId}`,
              { signal },
            );
            return { ...document, objectUrl: URL.createObjectURL(file.blob) };
          } catch (error) {
            // Un archivo ausente no tumba a los demás.
            if (error instanceof ApiError && error.kind === 'not-found') return null;
            throw error;
          }
        }),
      );
      const documents = traidos.filter((item): item is EvidenceImage => item !== null);

      const delExpediente =
        sujeto ??
        (intento?.customerId ? { tipo: 'customer' as const, id: intento.customerId } : null);
      let expedienteId: string | null = null;
      if (delExpediente) {
        const expediente = await imagenesDelExpediente(
          delExpediente.tipo,
          delExpediente.id,
          signal,
        );
        expedienteId = expediente.expedienteId;
        if (!documents.length) {
          documents.push(
            ...expediente.imagenes.map((imagen) => ({
              documentId: imagen.nodoId,
              documentType: imagen.nombre,
              mimeType: null,
              sizeBytes: null,
              sha256: imagen.sha256,
              objectUrl: imagen.objectUrl,
            })),
          );
        } else {
          expediente.imagenes.forEach((imagen) => URL.revokeObjectURL(imagen.objectUrl));
        }
      }
      if (!documents.length && !expedienteId && attemptId && !intento) {
        throw new ApiError(
          'El intento de verificación ya no existe y el caso no dice de qué cliente es.',
          404,
          'IDENTITY_ATTEMPT_NOT_FOUND',
        );
      }
      return { expedienteId, documents };
    },
  });

  // Las URL de objeto se liberan al cambiar de caso o desmontar.
  useEffect(() => {
    const urls = query.data?.documents.map((document) => document.objectUrl) ?? [];
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [query.data]);

  const adminPortalUrl = resolveAdminPortalUrl();

  if (!attemptId && !sujeto) {
    return (
      <Panel title="Documentos del solicitante" meta="sin vínculo con el cliente">
        <p className="muted">
          Este caso no dice de qué cliente o comercio es, así que no se puede llegar a su carnet ni
          a su expediente desde aquí. No lo resuelvas a ciegas.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Documentos del solicitante" meta="lo que subió el cliente">
      {query.isLoading ? <p className="muted">Cargando las imágenes…</p> : null}
      {query.error ? (
        <p className="muted">
          {query.error instanceof ApiError && query.error.kind === 'not-found'
            ? 'No se encontró el cliente de este caso ni su expediente. Decide con lo que muestra el caso o pide que vuelvan a subir los documentos.'
            : 'No se pudieron traer las imágenes. Vuelve a intentarlo; la decisión debería tomarse con ellas delante.'}
          {query.error instanceof ApiError && query.error.code ? ` (${query.error.code})` : ''}
        </p>
      ) : null}

      {query.data && !query.data.documents.length ? (
        <p className="muted">El expediente no tiene imágenes de este solicitante.</p>
      ) : null}

      {query.data?.documents.length ? (
        <CarruselDeDocumentos
          etiquetaDelGrupo="Documentos del solicitante"
          documentos={ordenarDocumentos(query.data.documents).map((documento) => ({
            id: documento.documentId,
            etiqueta: ETIQUETA[documento.documentType] ?? documento.documentType,
            objectUrl: documento.objectUrl,
            // El hash prueba que ESTA imagen es la que el motor evaluó.
            pie: documento.sha256 ? `${documento.sha256.slice(0, 12)}…` : undefined,
          }))}
        />
      ) : null}

      {adminPortalUrl && query.data?.expedienteId ? (
        <p className="muted">
          <a
            href={`${adminPortalUrl}/internal/files/${encodeURIComponent(query.data.expedienteId)}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver el expediente completo
          </a>{' '}
          — extractos, documentos añadidos después y la bitácora de quién abrió cada uno.
        </p>
      ) : null}
    </Panel>
  );
}
