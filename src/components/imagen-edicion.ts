/**
 * Giros, espejos y recortes de una imagen, hechos en el navegador del analista.
 *
 * ## Por qué existe
 *
 * Una cédula subida de lado o al revés obliga a leerla con la cabeza torcida, y la decisión humana
 * se toma justo sobre esos detalles (la serie, la fecha, la MRZ). Girar o recortar la imagen para
 * mirarla es una ayuda de LECTURA: nunca toca el original guardado ni lo que el Motor evaluó. El
 * resultado vive como blob local y desaparece al cerrar la pantalla.
 */
export type OperacionDeImagen =
  | { tipo: 'girar'; sentido: 'horario' | 'antihorario' }
  | { tipo: 'voltear'; eje: 'horizontal' | 'vertical' }
  /** Fracciones (0–1) del ancho y el alto de la imagen actual, independientes de su resolución. */
  | { tipo: 'recortar'; x: number; y: number; ancho: number; alto: number };

/** Área que la imagen ocupa de verdad dentro de una caja con `object-fit: contain`. */
export function areaVisibleDeImagen(
  caja: { ancho: number; alto: number },
  natural: { ancho: number; alto: number },
): { x: number; y: number; ancho: number; alto: number } {
  const escala = Math.min(caja.ancho / natural.ancho, caja.alto / natural.alto);
  const ancho = natural.ancho * escala;
  const alto = natural.alto * escala;
  return { x: (caja.ancho - ancho) / 2, y: (caja.alto - alto) / 2, ancho, alto };
}

function cargar(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
    imagen.src = url;
  });
}

function dibujar(origen: HTMLImageElement, operacion: OperacionDeImagen): HTMLCanvasElement {
  const w = origen.naturalWidth;
  const h = origen.naturalHeight;
  const lienzo = document.createElement('canvas');
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no permite editar imágenes.');

  if (operacion.tipo === 'recortar') {
    const sx = Math.round(operacion.x * w);
    const sy = Math.round(operacion.y * h);
    lienzo.width = Math.max(1, Math.round(operacion.ancho * w));
    lienzo.height = Math.max(1, Math.round(operacion.alto * h));
    contexto.drawImage(
      origen,
      sx,
      sy,
      lienzo.width,
      lienzo.height,
      0,
      0,
      lienzo.width,
      lienzo.height,
    );
  } else if (operacion.tipo === 'girar') {
    lienzo.width = h;
    lienzo.height = w;
    contexto.translate(h / 2, w / 2);
    contexto.rotate(((operacion.sentido === 'horario' ? 1 : -1) * Math.PI) / 2);
    contexto.drawImage(origen, -w / 2, -h / 2);
  } else {
    lienzo.width = w;
    lienzo.height = h;
    contexto.translate(w / 2, h / 2);
    contexto.scale(operacion.eje === 'horizontal' ? -1 : 1, operacion.eje === 'vertical' ? -1 : 1);
    contexto.drawImage(origen, -w / 2, -h / 2);
  }
  return lienzo;
}

/** Aplica la operación y devuelve la URL de objeto de la imagen resultante. */
export async function editarImagen(url: string, operacion: OperacionDeImagen): Promise<string> {
  const lienzo = dibujar(await cargar(url), operacion);
  const blob = await new Promise<Blob>((resolver, rechazar) =>
    lienzo.toBlob(
      (resultado) => (resultado ? resolver(resultado) : rechazar(new Error('Sin resultado.'))),
      'image/jpeg',
      0.92,
    ),
  );
  return URL.createObjectURL(blob);
}

/** Rectángulo arrastrado sobre la imagen, en fracciones (0–1) de su área real. */
export interface Seleccion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
