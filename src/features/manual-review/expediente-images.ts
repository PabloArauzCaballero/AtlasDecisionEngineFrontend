import { apiDownload } from '../../api/file-download';
import { apiRequest } from '../../api/http-client';
import { ApiError } from '../../api/ApiError';

/**
 * Los archivos del EXPEDIENTE del cliente o del comercio: carnet y selfie, y también los PDF.
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
  /** Vacío si el archivo figura en el expediente pero el almacén ya no lo tiene. */
  objectUrl: string;
  /** Tipo resuelto: el del nodo y, si no dice nada útil, el de la extensión. */
  mimeType: string;
  /** El expediente lo lista y el almacén no lo sirve: se enseña como ausente, nunca se esconde. */
  ausente: boolean;
}

/** Se baja a lo sumo tres niveles: el expediente es poco profundo y no se recorre un árbol sin tope. */
const PROFUNDIDAD_MAXIMA = 3;

const POR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * El tipo con el que se pinta un archivo.
 *
 * El almacén contesta `application/octet-stream` cuando no supo decir más, y un `<iframe>` con ese
 * tipo se queda en blanco sin un solo error. Manda lo que declare el nodo y, si tampoco ayuda, la
 * extensión del nombre.
 */
export function tipoDeArchivo(nombre: string, declarado: string | null): string {
  if (declarado && declarado !== 'application/octet-stream') return declarado;
  const extension = /\.([a-z0-9]+)$/i.exec(nombre)?.[1]?.toLowerCase() ?? '';
  return POR_EXTENSION[extension] ?? declarado ?? 'application/octet-stream';
}

/**
 * TODOS los archivos vivos del expediente, no sólo las imágenes.
 *
 * Antes se filtraba por `image/*`: el carnet y la selfie se veían, y la matrícula de comercio, el
 * NIT o el poder del representante —que llegan en PDF— desaparecían sin dejar rastro. El revisor
 * leía «el expediente no tiene imágenes» de un comercio que sí había subido sus documentos. Un
 * archivo que el almacén perdió (`objetoAusente`) también se devuelve: que falte es información.
 */
async function archivosDelExpediente(
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
  const archivos = vivos.filter((nodo) => nodo.tipo === 'archivo');
  if (nivel >= PROFUNDIDAD_MAXIMA) return archivos;
  const hijas = await Promise.all(
    vivos
      .filter((nodo) => nodo.tipo === 'carpeta')
      .map((carpeta) => archivosDelExpediente(expedienteId, carpeta.nodoId, nivel + 1, signal)),
  );
  return [...archivos, ...hijas.flat()];
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
  const imagenes = await imagenesDeExpediente(expediente.expedienteId, signal);
  return { expedienteId: expediente.expedienteId, imagenes };
}

/** Los archivos de un expediente por su número (el que muestra el portal en `/internal/files/<n>`). */
export async function imagenesDeExpediente(
  expedienteId: string,
  signal: AbortSignal,
): Promise<ImagenDeExpediente[]> {
  const nodos = await archivosDelExpediente(expedienteId, null, 1, signal);
  return Promise.all(
    nodos.map(async (nodo) => {
      const mimeType = tipoDeArchivo(nodo.nombre, nodo.mimeType);
      const base = { nodoId: nodo.nodoId, nombre: nodo.nombre, sha256: nodo.sha256, mimeType };
      if (nodo.objetoAusente) return { ...base, objectUrl: '', ausente: true };
      try {
        const archivo = await apiDownload(
          `/atlas-backend/expedientes/${encodeURIComponent(expedienteId)}/nodos/${encodeURIComponent(nodo.nodoId)}/contenido?disposition=inline`,
          nodo.nombre,
          { signal },
        );
        // Se reenvuelve con el tipo resuelto: es el tipo del BLOB el que decide si un marco pinta un PDF.
        const blob = new Blob([archivo.blob], { type: mimeType });
        return { ...base, objectUrl: URL.createObjectURL(blob), ausente: false };
      } catch (error) {
        // Un archivo que no baja no esconde a los demás: se lista como ausente.
        if (error instanceof ApiError && error.kind === 'not-found') {
          return { ...base, objectUrl: '', ausente: true };
        }
        throw error;
      }
    }),
  );
}
