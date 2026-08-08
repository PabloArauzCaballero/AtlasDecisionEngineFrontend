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

  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response) ?? fallbackFileName,
  };
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
