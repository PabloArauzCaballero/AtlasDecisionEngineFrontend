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

/** Las imágenes del expediente del cliente; vacío si no tiene expediente o no hay imágenes. */
export async function imagenesDelExpediente(
  customerId: string,
  signal: AbortSignal,
): Promise<ImagenDeExpediente[]> {
  const expediente = await apiRequest<Expediente | null>(
    `/atlas-backend/expedientes/por-sujeto/customer/${encodeURIComponent(customerId)}`,
    { signal },
  );
  if (!expediente?.expedienteId) return [];
  const nodos = await archivosDeImagen(expediente.expedienteId, null, 1, signal);
  return Promise.all(
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
}
