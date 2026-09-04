import { useCallback, useRef, useState } from 'react';

/**
 * Una imagen ya traída como blob local, lista para pintarse.
 *
 * La forma es deliberadamente pobre —id, etiqueta, url y un pie— porque el carrusel no debe saber
 * si lo que enseña son documentos de evidencia de AtlasBackend o las imágenes de una ejecución del
 * motor. Cuando lo sabía, añadir el segundo caso obligaba a copiarlo entero.
 */
export interface DiapositivaDeDocumento {
  id: string;
  etiqueta: string;
  objectUrl: string;
  /** Línea corta bajo la imagen activa. Suele ser el hash: prueba que ES la imagen que se evaluó. */
  pie?: string;
}

/**
 * Las capturas, en diapositivas que se pasan de lado, con ampliación.
 *
 * ## Por qué no es una rejilla
 *
 * Porque la rejilla las recortaba. `object-fit: cover` sobre una celda baja le come los bordes a
 * una cédula apaisada y le corta la frente a una selfie, y lo que hay que mirar en un caso de
 * identidad está justo ahí: la MRZ va pegada al borde inferior del reverso, y el pelo y la
 * mandíbula son la mitad de lo que distingue dos caras parecidas. La rejilla obligaba a abrir cada
 * imagen para ver la imagen — tres clics para empezar a trabajar.
 *
 * ## Por qué las flechas y los puntos, además del gesto
 *
 * El analista trabaja en un escritorio. Un carrusel que sólo responde al arrastre horizontal es
 * contenido inalcanzable para quien navega con tabulador. Los puntos son además el único sitio
 * donde se ve CUÁNTAS capturas hay sin recorrerlas.
 *
 * ## Por qué vive en `components/` y no junto a una pantalla
 *
 * Lo usan dos revisiones distintas —la manual de AtlasBackend y el arbitraje de identidad del
 * motor— y son la misma tarea: mirar el carnet y la cara de alguien para decidir. Duplicarlo
 * garantizaba que una de las dos se quedara sin las correcciones de la otra; ya pasó con la
 * carrera del desplazamiento que se documenta más abajo.
 */
export function CarruselDeDocumentos({
  documentos,
  etiquetaDelGrupo,
}: Readonly<{ documentos: DiapositivaDeDocumento[]; etiquetaDelGrupo: string }>) {
  const pista = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);
  const [ampliada, setAmpliada] = useState<string | null>(null);

  /*
   * El índice sale del desplazamiento real y no de un estado que el carrusel controle.
   *
   * Es la única forma de que los puntos acierten cuando la diapositiva la cambia el GESTO
   * —arrastre, rueda horizontal, deslizamiento del trackpad— y no un botón. Llevar un índice propio
   * obliga a sincronizarlo con cada una de esas entradas, y basta olvidarse de una para que el
   * indicador mienta sobre lo que se está mirando.
   */
  const alDesplazar = useCallback(() => {
    const nodo = pista.current;
    if (!nodo || nodo.clientWidth === 0) return;
    setIndice(Math.round(nodo.scrollLeft / nodo.clientWidth));
  }, []);

  /*
   * El destino se calcula desde el DOM, no desde el estado de React.
   *
   * Es la corrección de una carrera medida: `irA` fijaba el índice a la vez que lanzaba el
   * desplazamiento suave, y el manejador de `scroll` —que lee la posición REAL— lo revertía a mitad
   * de la animación. Dos pulsaciones seguidas en la flecha se quedaban en la segunda diapositiva.
   *
   * Con el destino derivado de `scrollLeft`, el estado tiene UN solo escritor —`alDesplazar`— y el
   * botón no puede desincronizarse con el gesto: los dos empujan la misma pista.
   */
  const irA = useCallback(
    (destino: number | ((actual: number) => number)) => {
      const nodo = pista.current;
      if (!nodo || nodo.clientWidth === 0) return;
      const actual = Math.round(nodo.scrollLeft / nodo.clientWidth);
      const pedido = typeof destino === 'function' ? destino(actual) : destino;
      const seguro = Math.max(0, Math.min(documentos.length - 1, pedido));
      nodo.scrollTo({ left: seguro * nodo.clientWidth, behavior: 'smooth' });
    },
    [documentos.length],
  );

  if (documentos.length === 0) return null;

  const activo = documentos[Math.min(indice, documentos.length - 1)];

  return (
    <>
      <div className="case-carousel">
        <div
          className="case-carousel__track"
          ref={pista}
          onScroll={alDesplazar}
          // `aria-roledescription` y no `role="listbox"`: esto no es una selección, es una galería, y
          // anunciarla como una lista de opciones haría que un lector de pantalla ofreciera «elegir»
          // una imagen que no se elige.
          aria-roledescription="carrusel"
          aria-label={etiquetaDelGrupo}
          tabIndex={0}
          onKeyDown={(evento) => {
            if (evento.key === 'ArrowRight') irA((actual) => actual + 1);
            if (evento.key === 'ArrowLeft') irA((actual) => actual - 1);
          }}
        >
          {documentos.map((documento) => (
            <figure key={documento.id} className="case-carousel__slide">
              <button
                type="button"
                className="case-carousel__button"
                onClick={() => setAmpliada(documento.objectUrl)}
                title="Ampliar"
              >
                <img src={documento.objectUrl} alt={documento.etiqueta} loading="lazy" />
              </button>
            </figure>
          ))}
        </div>

        {/*
          El pie describe la diapositiva ACTIVA y vive fuera de la pista.

          Dentro de cada una obligaría a que todas tuvieran la misma altura de texto para que nada
          saltase al pasar. Fuera, el texto cambia y el bloque no se mueve.
        */}
        <div className="case-carousel__caption">
          <strong>{activo?.etiqueta}</strong>
          {activo?.pie ? <span className="mono">{activo.pie}</span> : null}
        </div>

        <div className="case-carousel__nav">
          <button
            type="button"
            className="case-carousel__arrow"
            onClick={() => irA((actual) => actual - 1)}
            disabled={indice === 0}
            aria-label="Documento anterior"
          >
            ←
          </button>
          <div className="case-carousel__dots">
            {documentos.map((documento, posicion) => (
              <button
                key={documento.id}
                type="button"
                className={`case-carousel__dot${posicion === indice ? ' is-active' : ''}`}
                onClick={() => irA(posicion)}
                aria-label={`Ir a ${documento.etiqueta}`}
                aria-current={posicion === indice}
              />
            ))}
          </div>
          <span className="case-carousel__count">
            {indice + 1} / {documentos.length}
          </span>
          <button
            type="button"
            className="case-carousel__arrow"
            onClick={() => irA((actual) => actual + 1)}
            disabled={indice >= documentos.length - 1}
            aria-label="Documento siguiente"
          >
            →
          </button>
        </div>
      </div>

      {ampliada ? (
        <button type="button" className="case-image__overlay" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="Documento ampliado" />
        </button>
      ) : null}
    </>
  );
}
