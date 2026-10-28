/**
 * El blob de un PDF subido por un tercero, listo para un `<iframe>`.
 *
 * El extracto lo subió un cliente y el visor lo pinta en un marco `blob:` DEL MISMO ORIGEN que el
 * portal. El tipo del blob lo decide la cabecera `Content-Type` de la respuesta, es decir, el
 * servidor; si algún día contestara `text/html` (o `image/svg+xml`) con el archivo del cliente, el
 * marco lo interpretaría como un documento con el origen del portal. Hoy la CSP lo contiene —el
 * documento `blob:` hereda `script-src` con nonce y `strict-dynamic`, así que un script en línea no
 * corre—, pero depender de eso es depender de una sola capa.
 *
 * Aquí el tipo se fija en el cliente: lo que el visor enseña es un PDF o no se enseña. Es la misma
 * decisión que ya toman los archivos del expediente (`manual-review/expediente-images.ts`), donde
 * «es el tipo del BLOB el que decide si un marco pinta un PDF».
 */
export function asPdfBlob(blob: Blob): Blob {
  return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
}
