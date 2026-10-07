import { useState } from 'react';
import { CarruselDeDocumentos } from '../../components/CarruselDeDocumentos';
import type { ImagenDeExpediente } from './expediente-images';

/**
 * Todo lo que el solicitante subió, se pueda pintar como imagen o no.
 *
 * ## Por qué existe
 *
 * El caso enseñaba sólo las imágenes del expediente. Un comercio sube su matrícula, su NIT y el
 * poder del representante en PDF, así que quien revisaba leía «el expediente no tiene imágenes» y
 * tenía que aprobar o rechazar sin haber visto un solo documento. Aquí las imágenes van al carrusel
 * de siempre y TODO lo demás a una lista: el PDF se abre en la misma pantalla, cualquier otro tipo
 * se descarga, y un archivo que el expediente lista pero el almacén ya no tiene se dice.
 *
 * Ningún archivo se esconde por su tipo. Que falte uno es información para decidir.
 */
export function ArchivosDelExpediente({
  archivos,
  etiquetaDelGrupo,
}: Readonly<{ archivos: readonly ImagenDeExpediente[]; etiquetaDelGrupo: string }>) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const imagenes = archivos.filter(
    (archivo) => !archivo.ausente && archivo.mimeType.startsWith('image/'),
  );
  const otros = archivos.filter(
    (archivo) => archivo.ausente || !archivo.mimeType.startsWith('image/'),
  );
  const visto = otros.find((archivo) => archivo.nodoId === abierto && !archivo.ausente);

  return (
    <>
      {imagenes.length ? (
        <CarruselDeDocumentos
          etiquetaDelGrupo={etiquetaDelGrupo}
          documentos={imagenes.map((imagen) => ({
            id: imagen.nodoId,
            etiqueta: imagen.nombre,
            objectUrl: imagen.objectUrl,
            // El hash prueba que ESTA imagen es la que se guardó.
            pie: imagen.sha256 ? `${imagen.sha256.slice(0, 12)}…` : undefined,
          }))}
        />
      ) : null}

      {otros.length ? (
        <div className="case-files">
          <p className="muted">
            {otros.length === 1 ? 'Un documento más' : `${otros.length} documentos más`} en el
            expediente:
          </p>
          <ul className="case-files__list">
            {otros.map((archivo) => (
              <li key={archivo.nodoId} className="case-files__item">
                <span className="case-files__name">{archivo.nombre}</span>
                {archivo.ausente ? (
                  <span className="case-files__missing">
                    Figura en el expediente pero el archivo no está en el almacén. Pide que lo
                    vuelvan a subir.
                  </span>
                ) : (
                  <span className="case-files__actions">
                    {archivo.mimeType === 'application/pdf' ? (
                      <button
                        type="button"
                        className="button"
                        aria-expanded={abierto === archivo.nodoId}
                        onClick={() =>
                          setAbierto(abierto === archivo.nodoId ? null : archivo.nodoId)
                        }
                      >
                        {abierto === archivo.nodoId ? 'Cerrar' : 'Ver aquí'}
                      </button>
                    ) : null}
                    <a className="button" href={archivo.objectUrl} download={archivo.nombre}>
                      Descargar
                    </a>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {visto ? (
            <iframe className="case-files__viewer" src={visto.objectUrl} title={visto.nombre} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
