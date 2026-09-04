import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError } from '../../api/ApiError';
import { apiDownload } from '../../api/file-download';
import {
  CarruselDeDocumentos,
  type DiapositivaDeDocumento,
} from '../../components/CarruselDeDocumentos';

/**
 * Las tres imágenes de una ejecución.
 *
 * ## Por qué la ruta SÍ interpola el último segmento
 *
 * La regla del repositorio es no interpolar el nombre de la operación, porque el inventario de
 * superficie (`scripts/engine-surface.mjs`) leería ese `{p}` como un comodín y daría por
 * consumidas también las operaciones vecinas que nadie llama. Aquí no hay vecinas: el motor
 * publica UNA sola operación bajo `/runs/{requestId}/images/{kind}`, y `cancel` —la otra ruta de
 * la rama— tiene un segmento menos, así que el emparejamiento por longitud ni la considera.
 *
 * Y hace falta que sea así: el comodín del gate está del lado del PORTAL, de modo que escribir los
 * tres literales concretos (`/images/document`…) NO casa con el `/images/{p}` del inventario y el
 * endpoint quedaba contado como superficie que nadie mira. Se probó, y ese fue el efecto.
 */
const IMAGENES = [
  { kind: 'document', etiqueta: 'Anverso del carnet' },
  { kind: 'documentBack', etiqueta: 'Reverso del carnet' },
  { kind: 'selfie', etiqueta: 'Selfie' },
] as const;

/**
 * Las imágenes de la ejecución que se está arbitrando.
 *
 * ## Por qué esta pantalla no las tenía
 *
 * Porque hasta el 2026-09-03 no existían. El motor guardaba la cara y las dos caras del carnet en
 * columnas `Bytes` y las ponía a `null` al cerrar la ejecución, así que para cuando el caso llegaba
 * a esta cola la evidencia ya no estaba. La cola se resolvía leyendo «evidencia 62 %» y un código
 * de motivo: decidir si un documento es un documento **sin verlo**.
 *
 * Ahora se copian a MinIO al ingresar y el motor las sirve por
 * `GET /v1/workers/identity-verification/runs/:requestId/images/:kind`.
 *
 * ## Por qué se piden como blob y no con `<img src>`
 *
 * Una etiqueta `<img>` sólo tiene una dirección: no puede mandar `Authorization`, que esta
 * aplicación guarda en memoria y no en una cookie. El motor responde 401 y lo que se pinta es el
 * icono de imagen rota. Pidiéndolas por la puerta autenticada la credencial va puesta, la
 * renovación de token vale igual, y el inquilino y el rol los sigue decidiendo el servidor — no una
 * URL pública que expondría la cara de una persona fuera de sus controles.
 */
export function ImagenesDeLaEjecucion({ requestId }: Readonly<{ requestId: string }>) {
  const query = useQuery({
    queryKey: ['identity-run-images', requestId],
    enabled: Boolean(requestId),
    // Las imágenes de una ejecución no cambian nunca: una vez traídas, volver a pedirlas al
    // reenfocar la pestaña sólo gasta ancho de banda y vuelve a mover megas de PII por la red.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<DiapositivaDeDocumento[]> => {
      const id = encodeURIComponent(requestId);
      const traidas = await Promise.all(
        IMAGENES.map(async ({ kind, etiqueta }): Promise<DiapositivaDeDocumento | null> => {
          try {
            const file = await apiDownload(
              `/v1/workers/identity-verification/runs/${id}/images/${kind}`,
              `${requestId}-${kind}`,
              { signal },
            );
            return { id: kind, etiqueta, objectUrl: URL.createObjectURL(file.blob) };
          } catch (error) {
            /*
             * Un 404 aquí es NORMAL y no un fallo: puede ser un caso sin reverso —sólo el anverso y
             * la selfie son obligatorios— o una ejecución anterior a que el motor conservara nada.
             * Tratarlo como error dejaría sin ver el anverso y la selfie por faltar la tercera.
             *
             * Cualquier otro error sí se propaga: un 401 o un 500 significan que las imágenes
             * EXISTEN y no se están pudiendo traer, y eso quien arbitra tiene que saberlo antes de
             * decidir a ciegas.
             */
            if (error instanceof ApiError && error.status === 404) return null;
            throw error;
          }
        }),
      );
      return traidas.filter((imagen): imagen is DiapositivaDeDocumento => imagen !== null);
    },
  });

  // Las URL de objeto se liberan al cambiar de caso o desmontar: sin esto, cada caso mirado deja
  // sus blobs en memoria hasta recargar la pestaña.
  useEffect(() => {
    const urls = query.data?.map((imagen) => imagen.objectUrl) ?? [];
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [query.data]);

  if (!requestId) return null;

  if (query.isLoading) {
    return <p className="field-help">Trayendo las imágenes del caso…</p>;
  }

  if (query.error) {
    return (
      <p className="field-help">
        No se pudieron traer las imágenes de esta verificación. La decisión debería tomarse con
        ellas delante: vuelve a abrir el caso antes de resolverlo.
      </p>
    );
  }

  if (!query.data?.length) {
    /*
     * Se dice POR QUÉ no están, y no un «sin imágenes» a secas. Es la diferencia entre «este caso
     * es raro» y «esta ejecución es de antes y su evidencia ya no existe», y sólo la segunda
     * explica que haya que resolverlo con lo que hay.
     */
    return (
      <p className="field-help">
        Esta ejecución no conservó sus imágenes: es anterior al 3 de septiembre de 2026, cuando el
        motor empezó a guardarlas. No hay de dónde recuperarlas.
      </p>
    );
  }

  return (
    <CarruselDeDocumentos etiquetaDelGrupo="Imágenes de la verificación" documentos={query.data} />
  );
}
