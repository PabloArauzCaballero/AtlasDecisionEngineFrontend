/**
 * Vuelca a disco un archivo ya descargado.
 *
 * El blob llegó por la puerta autenticada; esto sólo lo guarda. Parece trivial y
 * tiene una trampa que produce archivos CORRUPTOS:
 *
 *  1. **El ancla tiene que estar en el documento.** Un `<a>` suelto en memoria no
 *     dispara la descarga en todos los navegadores; unos la ignoran y otros la
 *     empiezan sin terminarla.
 *  2. **`revokeObjectURL` NO puede llamarse justo después del clic.** El clic sólo
 *     PROGRAMA la descarga: el navegador lee el blob después, de forma asíncrona.
 *     Revocar la URL en la misma vuelta del bucle de eventos se la quita de debajo
 *     y el archivo sale a medias — un PDF truncado que el lector rechaza. Ése era
 *     el defecto: el archivo se descargaba corrupto aunque el servidor hubiera
 *     devuelto los bytes completos.
 *
 * Se revoca en un `setTimeout`, que es lo que da tiempo a que la lectura empiece.
 * No revocarlo nunca tampoco vale: cada documento generado dejaría su copia en
 * memoria hasta recargar la pestaña, y aquí se generan en serie.
 */
const MARGEN_PARA_QUE_EMPIECE_LA_LECTURA_MS = 60_000;

export function saveFile(blob: Blob, fileName: string): void {
  // El tipo se fuerza a PDF si el transporte lo perdió: sin él, algunos
  // navegadores guardan el archivo sin extensión o lo abren como texto.
  const contenido = blob.type ? blob : new Blob([blob], { type: 'application/pdf' });
  const url = URL.createObjectURL(contenido);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), MARGEN_PARA_QUE_EMPIECE_LA_LECTURA_MS);
}
