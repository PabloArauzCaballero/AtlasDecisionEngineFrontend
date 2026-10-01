import { apiDownload } from '../../api/file-download';
import { apiRequest } from '../../api/http-client';

/**
 * El carnet y la selfie desde el EXPEDIENTE del cliente.
 *
 * El portal interno los muestra de ahí (`/internal/files/…`), y es la copia que sobrevive cuando
 * el registro de evidencias del alta ya no sirve el archivo. Es la misma puerta autenticada, con
 * el mismo rol y el mismo registro de quién abrió cada archivo: no es una vía pública.
 */
interface Expediente {
  expedienteId: string;
}

interface Nodo {
  nodoId: string;
  tipo: 'carpeta' | 'archivo';
  nombre: string;
  clase: string | null;
  mimeType: string | null;
  sha256: string | null;
  objetoAusente: boolean;
  borradoEn: string | null;
}

export interface ImagenDeExpediente {
  nodoId: string;
  nombre: string;
  sha256: string | null;
  objectUrl: string;
}

/** Se baja a lo sumo tres niveles: el expediente de identidad es poco profundo y no se recorre un árbol sin tope. */
const PROFUNDIDAD_MAXIMA = 3;

async function archivosDeImagen(
  expedienteId: string,
  parentId: string | null,
  nivel: number,
  signal: AbortSignal,
): Promise<Nodo[]> {
  const consulta = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
  const nodos = await apiRequest<Nodo[]>(
    `/atlas-backend/expedientes/${encodeURIComponent(expedienteId)}/nodos${consulta}`,
    { signal },
  );
  const vivos = (Array.isArray(nodos) ? nodos : []).filter((nodo) => !nodo.borradoEn);
  const imagenes = vivos.filter(
    (nodo) => nodo.tipo === 'archivo' && !nodo.objetoAusente && nodo.mimeType?.startsWith('image/'),
  );
  if (nivel >= PROFUNDIDAD_MAXIMA) return imagenes;
  const hijas = await Promise.all(
    vivos
      .filter((nodo) => nodo.tipo === 'carpeta')
      .map((carpeta) => archivosDeImagen(expedienteId, carpeta.nodoId, nivel + 1, signal)),
  );
  return [...imagenes, ...hijas.flat()];
}

export type TipoDeSujeto = 'customer' | 'partner';

export interface ImagenesDelExpediente {
  /** `null` si el sujeto no tiene expediente. */
  expedienteId: string | null;
  imagenes: ImagenDeExpediente[];
}

/**
 * De quién es un caso, leído de su propio `requestId`.
 *
 * El caso del Motor no guarda el cliente: sólo el `requestId` y el `correlationId` viajan en
 * claro. Antes el vínculo era el id del intento de verificación, que se pierde con el intento (y
 * en comercios no existía), y el caso quedaba sin carnet ni expediente para siempre. Ahora quien
 * llama al Motor pone el sujeto en el `requestId` y aquí se lee:
 * - `kyb-<comercio>-…` — evaluación de un comercio (AtlasBackend, desde el ERP o el portal).
 * - `identity-<cliente>-…` — verificación de identidad de un cliente.
 * Un `requestId` de otra forma (casos anteriores de identidad) devuelve `null` y se cae al intento.
 */
export function sujetoDelCaso(requestId: string): { tipo: TipoDeSujeto; id: string } | null {
  const comercio = /^kyb-(\d+)-/.exec(requestId);
  if (comercio?.[1]) return { tipo: 'partner', id: comercio[1] };
  const cliente = /^identity-(\d+)-/.exec(requestId);
  if (cliente?.[1]) return { tipo: 'customer', id: cliente[1] };
  return null;
}

/** Las imágenes del expediente del sujeto; vacío si no tiene expediente o no hay imágenes. */
export async function imagenesDelExpediente(
  tipo: TipoDeSujeto,
  sujetoId: string,
  signal: AbortSignal,
  /** `false` sólo resuelve el expediente (para enlazarlo) sin bajar sus archivos. */
  descargar = true,
): Promise<ImagenesDelExpediente> {
  const expediente = await apiRequest<Expediente | null>(
    `/atlas-backend/expedientes/por-sujeto/${tipo}/${encodeURIComponent(sujetoId)}`,
    { signal },
  );
  if (!expediente?.expedienteId) return { expedienteId: null, imagenes: [] };
  if (!descargar) return { expedienteId: expediente.expedienteId, imagenes: [] };
  const nodos = await archivosDeImagen(expediente.expedienteId, null, 1, signal);
  const imagenes = await Promise.all(
    nodos.map(async (nodo) => {
      const archivo = await apiDownload(
        `/atlas-backend/expedientes/${encodeURIComponent(expediente.expedienteId)}/nodos/${encodeURIComponent(nodo.nodoId)}/contenido?disposition=inline`,
        nodo.nombre,
        { signal },
      );
      return {
        nodoId: nodo.nodoId,
        nombre: nodo.nombre,
        sha256: nodo.sha256,
        objectUrl: URL.createObjectURL(archivo.blob),
      };
    }),
  );
  return { expedienteId: expediente.expedienteId, imagenes };
}
