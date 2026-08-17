import { ApiError } from './ApiError';
import { authorizedFetch, type ApiRequestOptions } from './http-client';
import { parseResponse } from './response';

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

/**
 * Descarga un archivo del motor por la misma puerta autenticada que el resto.
 *
 * Un `<a href="/v1/…" download>` no sirve: seguir un enlace es una navegación
 * del navegador y ahí no viaja el `Authorization`, que esta aplicación guarda en
 * memoria y no en una cookie. El motor responde 401 y lo que se descarga es el
 * error. Pidiéndolo aquí la credencial va puesta, la renovación de token vale
 * igual que en cualquier otra llamada, y un error del servidor —«todavía no ha
 * terminado»— llega como error y no como un archivo con un problema dentro.
 *
 * La autorización la sigue decidiendo el servidor: esto pone la credencial, no
 * la sustituye.
 */
export async function apiDownload(
  path: string,
  fallbackFileName: string,
  options: ApiRequestOptions<never> = {},
): Promise<DownloadedFile> {
  // `accept: */*`: el archivo puede ser CSV o JSON y no se sabe cuál hasta
  // pedirlo. Sin esto la petición diría `application/json`, que la describe mal.
  const response = await authorizedFetch<never>(path, {
    ...options,
    headers: { accept: '*/*', ...(options.headers as Record<string, string> | undefined) },
  });

  if (!response.ok) {
    // `parseResponse` traduce el cuerpo del motor a `ApiError` con su mensaje;
    // siempre lanza cuando la respuesta no es correcta. El `throw` de después
    // sólo existe para que el tipo de retorno no admita `undefined`.
    await parseResponse(response);
    throw new ApiError('No fue posible descargar el archivo.', response.status, 'DOWNLOAD_FAILED');
  }

  assertExpectedType(response, options.headers);

  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response) ?? fallbackFileName,
  };
}

/**
 * Un 200 con el tipo equivocado NO es una descarga válida.
 *
 * Sin esta comprobación, una respuesta correcta pero de otro tipo se guardaba
 * igual y el defecto sólo aparecía al ABRIR el archivo. Fue exactamente lo que
 * pasó con `POST /pdf/generate`: la misma ruta responde el archivo o la ficha
 * según `Accept`, un `accept` perdido por el camino devolvía la ficha en JSON, y
 * lo que llegaba al disco era un «PDF corrupto» que por dentro eran metadatos.
 *
 * Sólo aplica cuando quien descarga pidió un tipo CONCRETO. Con el comodín no
 * hay nada que contrastar, y así la mayoría de descargas —que no saben de
 * antemano si reciben CSV o JSON— siguen sin restricción.
 */
function assertExpectedType(response: Response, headers: HeadersInit | undefined): void {
  const wanted = new Headers(headers).get('accept');
  if (!wanted || wanted.includes('*/*')) return;

  const received = mediaType(response.headers.get('content-type'));
  if (received && wanted.split(',').some((type) => mediaType(type) === received)) return;

  throw new ApiError(
    `El servidor respondió ${received ?? 'sin tipo declarado'} donde se esperaba ${wanted}. ` +
      'Guardar esa respuesta produciría un archivo ilegible.',
    response.status,
    'DOWNLOAD_WRONG_CONTENT_TYPE',
    undefined,
    'contract',
  );
}

/** El tipo a secas, sin `charset` ni factor de calidad. */
function mediaType(value: string | null): string | null {
  const type = value?.split(';')[0].trim().toLowerCase();
  return type ? type : null;
}

/**
 * Nombre propuesto por el servidor, saneado.
 *
 * El valor llega en una cabecera y termina en el atributo `download` de un
 * enlace: se le quitan separadores de ruta y caracteres de control para que no
 * signifique nada distinto de un nombre de archivo. Si no queda nada utilizable,
 * decide quien llama.
 */
function fileNameFromDisposition(response: Response): string | null {
  const raw = response.headers.get('content-disposition');
  if (!raw) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(raw);
  if (!match) return null;

  let candidate: string;
  try {
    candidate = decodeURIComponent(match[1]);
  } catch {
    candidate = match[1];
  }

  // Filtrado carácter a carácter y no con una clase de expresión regular: el
  // rango de control se escribe con bytes invisibles en el fuente, y lo que no
  // se ve no se revisa.
  const safe = [...candidate]
    .filter((char) => char > '\u001f' && char !== '\u007f' && char !== '/' && char !== '\\')
    .join('')
    .replaceAll('..', '')
    .trim();
  return safe ? safe.slice(0, 255) : null;
}
