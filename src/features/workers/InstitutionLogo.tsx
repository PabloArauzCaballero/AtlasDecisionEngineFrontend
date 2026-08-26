'use client';

import { useEffect, useRef, useState } from 'react';
import { Landmark } from 'lucide-react';
import { fetchInstitutionLogo } from './institutions.api';

/**
 * El logotipo de una entidad del padrón.
 *
 * ## Por qué no es un `<img src="/v1/…">`
 *
 * Porque la etiqueta `<img>` sólo tiene una dirección: no puede mandar la
 * cabecera `Authorization`, que esta aplicación guarda en memoria y no en una
 * cookie. El motor responde 401 y lo que se pinta es el icono de imagen rota —y
 * la lectura obvia de sesenta y ocho iconos rotos es «el padrón está mal», que
 * es justo lo contrario de lo que pasa. Se pide por la puerta autenticada y se
 * dibuja desde un blob local, igual que las imágenes de la revisión manual.
 *
 * ## Y por qué la URL de objeto se revoca
 *
 * Cada blob que el navegador guarda vive hasta que se le dice que lo suelte. Una
 * tabla de sesenta y ocho entidades que se vuelve a montar cada vez que alguien
 * cambia un filtro deja sesenta y ocho blobs por montaje, y el consumo sólo
 * baja al recargar la página. Es una fuga silenciosa, del tipo que se
 * diagnostica como «el portal se pone lento».
 */
export function InstitutionLogo({
  code,
  name,
  hasLogo,
  size = 32,
}: Readonly<{ code: string; name: string; hasLogo: boolean; size?: number }>) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallido, setFallido] = useState(false);
  const vigente = useRef<string | null>(null);

  useEffect(() => {
    if (!hasLogo) return;
    let cancelado = false;
    const control = new AbortController();

    fetchInstitutionLogo(code, control.signal)
      .then((objectUrl) => {
        if (cancelado) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        vigente.current = objectUrl;
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelado) setFallido(true);
      });

    return () => {
      cancelado = true;
      control.abort();
      if (vigente.current) {
        URL.revokeObjectURL(vigente.current);
        vigente.current = null;
      }
    };
  }, [code, hasLogo]);

  /*
   * Sin logotipo se dibuja un marcador NEUTRO, no un hueco. Una celda vacía en
   * una tabla se lee como un fallo de carga; un icono de institución se lee como
   * lo que es —esta entidad no tiene logotipo cargado— y además mantiene la
   * altura de la fila estable mientras las demás imágenes llegan.
   */
  if (!hasLogo || fallido || !url) {
    return (
      <span
        className="entidad-logo entidad-logo-vacio"
        style={{ width: size, height: size }}
        title={fallido ? `No se pudo cargar el logotipo de ${code}` : `${code} sin logotipo`}
      >
        <Landmark size={Math.round(size * 0.55)} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      className="entidad-logo"
      style={{ width: size, height: size }}
      src={url}
      alt={`Logotipo de ${name}`}
      width={size}
      height={size}
      loading="lazy"
    />
  );
}
