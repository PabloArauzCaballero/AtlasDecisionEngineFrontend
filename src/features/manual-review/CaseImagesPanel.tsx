import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiRequest } from '../../api/http-client';
import { apiDownload } from '../../api/file-download';
import { CarruselDeDocumentos } from '../../components/CarruselDeDocumentos';
import { Panel } from '../../components/Panel';
import { ApiError } from '../../api/ApiError';
import { resolveAdminPortalUrl } from '../../config/env';

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

  const adminPortalUrl = resolveAdminPortalUrl();

  if (!attemptId) {
    /*
     * Antes devolvía `null` y el panel desaparecía sin decir nada: el analista no sabía si el caso
     * no tenía carnet o si la pantalla no lo estaba trayendo.
     */
    return (
      <Panel title="Documentos del solicitante" meta="sin vínculo con la verificación">
        <p className="muted">
          Este caso no trae el identificador del intento de verificación, así que no se puede llegar
          a su carnet ni a su selfie desde aquí. No lo resuelvas a ciegas.
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
            ? // El caso apunta a un intento de verificación que la plataforma ya no conserva
              // (barrido de TEST, 2026-09-29: caso 6 → 404 IDENTITY_ATTEMPT_NOT_FOUND).
              'Los documentos de este cliente ya no están disponibles en la plataforma. Decide con lo que muestra el caso o pide al cliente que vuelva a subirlos.'
            : 'No se pudieron traer las imágenes del cliente. Vuelve a intentarlo; la decisión debería tomarse con ellas delante.'}
        </p>
      ) : null}

      {query.data && !query.data.documents.length ? (
        <p className="muted">
          El cliente no tiene documentos de identidad guardados para este intento.
        </p>
      ) : null}

      {query.data?.documents.length ? (
        <CarruselDeDocumentos
          etiquetaDelGrupo="Documentos del solicitante"
          documentos={ordenarDocumentos(query.data.documents).map((documento) => ({
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

      {/*
        Estas imágenes son las que el Motor evaluó, no todo lo que la persona entregó: los
        extractos, lo que subió después y lo que añadió un operador viven en su expediente. Quien
        revisa a mano necesita saber que existe ese resto; decidir creyendo que se vio todo es
        peor que saber que falta por mirar.
      */}
      {adminPortalUrl && query.data?.customerId ? (
        <p className="muted">
          <a
            href={`${adminPortalUrl}/internal/files/cliente/${encodeURIComponent(query.data.customerId)}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver el expediente completo del cliente
          </a>{' '}
          — extractos, documentos añadidos después y la bitácora de quién abrió cada uno.
        </p>
      ) : null}
    </Panel>
  );
}
