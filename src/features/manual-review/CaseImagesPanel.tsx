import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { apiDownload } from '../../api/file-download';
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
  const [ampliada, setAmpliada] = useState<string | null>(null);

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
      const meta = body.data ?? { customerId: body.customerId ?? '', documents: body.documents ?? [] };
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
          documentos={query.data.documents}
          onAmpliar={(url) => setAmpliada(url)}
        />
      ) : null}

      {ampliada ? (
        <button type="button" className="case-image__overlay" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="Documento ampliado" />
        </button>
      ) : null}
    </Panel>
  );
}

/**
 * Las capturas, en slides que se pasan de lado.
 *
 * ## Por qué dejó de ser una rejilla
 *
 * Porque la rejilla las recortaba. `object-fit: cover` sobre una celda de 130 px de alto le come
 * los bordes a una cédula apaisada y le corta la frente a una selfie, y lo que hay que mirar en un
 * caso de identidad está justo ahí: la MRZ va pegada al borde inferior del reverso, y el pelo y la
 * mandíbula son la mitad de lo que distingue dos caras parecidas. La rejilla obligaba a abrir cada
 * imagen para ver la imagen — o sea, tres clics para empezar a trabajar.
 *
 * Un carrusel a ancho completo con `object-fit: contain` enseña cada captura ENTERA, y pasarlas de
 * lado es el gesto de mirar fotos. La ampliación sigue estando para el detalle fino, que es lo que
 * una lupa debe ser: un paso opcional y no el único camino a ver el documento.
 *
 * ## Por qué las flechas y los puntos, además del gesto
 *
 * El analista trabaja en un escritorio, con ratón y teclado. Un carrusel que sólo responde al
 * arrastre horizontal es contenido inalcanzable para quien navega con tabulador, y molesto para
 * quien tiene un ratón sin rueda horizontal. Los puntos son además el único sitio donde se ve
 * CUÁNTAS capturas hay sin recorrerlas.
 */
function CarruselDeDocumentos({
  documentos,
  onAmpliar,
}: Readonly<{ documentos: EvidenceImage[]; onAmpliar: (url: string) => void }>) {
  const pista = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);

  /*
   * El índice sale del desplazamiento real y no de un estado que el carrusel controle.
   *
   * Es la única forma de que los puntos acierten cuando la slide la cambia el GESTO —arrastre,
   * rueda horizontal, deslizamiento del trackpad— y no un botón. Llevar un índice propio obliga a
   * sincronizarlo con cada una de esas entradas, y basta olvidarse de una para que el indicador
   * mienta sobre lo que se está mirando.
   */
  const alDesplazar = useCallback(() => {
    const nodo = pista.current;
    if (!nodo || nodo.clientWidth === 0) return;
    setIndice(Math.round(nodo.scrollLeft / nodo.clientWidth));
  }, []);

  /*
   * El destino se calcula desde el DOM, no desde el estado de React.
   *
   * Es la corrección de una carrera medida: `irA` fijaba el índice a la vez que lanzaba el
   * desplazamiento suave, y el manejador de `scroll` —que lee la posición REAL— lo revertía a mitad
   * de la animación. Dos pulsaciones seguidas en la flecha se quedaban en la segunda slide, porque
   * la segunda leía un índice que el scroll acababa de deshacer.
   *
   * Con el destino derivado de `scrollLeft`, el estado tiene UN solo escritor —`alDesplazar`— y el
   * botón no puede desincronizarse con el gesto: los dos empujan la misma pista.
   */
  const irA = useCallback(
    (destino: number | ((actual: number) => number)) => {
      const nodo = pista.current;
      if (!nodo || nodo.clientWidth === 0) return;
      const actual = Math.round(nodo.scrollLeft / nodo.clientWidth);
      const pedido = typeof destino === 'function' ? destino(actual) : destino;
      const seguro = Math.max(0, Math.min(documentos.length - 1, pedido));
      nodo.scrollTo({ left: seguro * nodo.clientWidth, behavior: 'smooth' });
    },
    [documentos.length],
  );

  const activo = documentos[indice];

  return (
    <div className="case-carousel">
      <div
        className="case-carousel__track"
        ref={pista}
        onScroll={alDesplazar}
        // `aria-roledescription` y no `role="listbox"`: esto no es una selección, es una galería, y
        // anunciarla como una lista de opciones haría que un lector de pantalla ofreciera «elegir»
        // una imagen que no se elige.
        aria-roledescription="carrusel"
        aria-label="Documentos del solicitante"
        tabIndex={0}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowRight') irA((actual) => actual + 1);
          if (evento.key === 'ArrowLeft') irA((actual) => actual - 1);
        }}
      >
        {documentos.map((document) => (
          <figure key={document.documentId} className="case-carousel__slide">
            <button
              type="button"
              className="case-carousel__button"
              onClick={() => onAmpliar(document.objectUrl)}
              title="Ampliar"
            >
              <img
                src={document.objectUrl}
                alt={ETIQUETA[document.documentType] ?? document.documentType}
                loading="lazy"
              />
            </button>
          </figure>
        ))}
      </div>

      {/*
        El pie describe la slide ACTIVA y vive fuera de la pista.

        Dentro de cada slide obligaría a que las tres tuvieran la misma altura de texto para que
        nada saltase al pasar. Fuera, el texto cambia y el bloque no se mueve.
      */}
      <div className="case-carousel__caption">
        <strong>{ETIQUETA[activo?.documentType ?? ''] ?? activo?.documentType}</strong>
        {/*
          El hash se enseña porque es lo que prueba que ESTA imagen es la que el motor evaluó: su
          instantánea de entrada guarda el mismo valor. Sin él, «vi la foto» y «vi la foto que se
          decidió» son la misma frase para dos cosas distintas.
        */}
        <span className="mono">{activo?.sha256?.slice(0, 12)}…</span>
      </div>

      <div className="case-carousel__nav">
        <button
          type="button"
          className="case-carousel__arrow"
          onClick={() => irA((actual) => actual - 1)}
          disabled={indice === 0}
          aria-label="Documento anterior"
        >
          ←
        </button>
        <div className="case-carousel__dots">
          {documentos.map((document, posicion) => (
            <button
              key={document.documentId}
              type="button"
              className={`case-carousel__dot${posicion === indice ? ' is-active' : ''}`}
              onClick={() => irA(posicion)}
              aria-label={`Ir a ${ETIQUETA[document.documentType] ?? document.documentType}`}
              aria-current={posicion === indice}
            />
          ))}
        </div>
        <span className="case-carousel__count">
          {indice + 1} / {documentos.length}
        </span>
        <button
          type="button"
          className="case-carousel__arrow"
          onClick={() => irA((actual) => actual + 1)}
          disabled={indice >= documentos.length - 1}
          aria-label="Documento siguiente"
        >
          →
        </button>
      </div>
    </div>
  );
}
